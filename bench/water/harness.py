"""A/B token harness: Grok-Bot-style multi-turn repo-QA tasks, without vs with PMLL KV memory.
No LLM API key available -> tokens counted with tiktoken o200k_base over the exact prompt text
each turn would send; 'output' = deterministic extractive answer (same text in A and B).
Memory code: drQedwards/pmll mcp/pmll_memory_mcp/kv_store.py @85f70e8 (PMMemoryStore), run locally."""
import csv, json, os, random, re, sys, hashlib
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_here, "..", "..", "mcp"))  # repo copy of pmll_memory_mcp
from pmll_memory_mcp.kv_store import PMMemoryStore
import tiktoken
enc = tiktoken.get_encoding("o200k_base"); T = lambda s: len(enc.encode(s))
C = os.path.join(_here, "corpus"); DOCS = {f: open(os.path.join(C, f)).read() for f in sorted(os.listdir(C))}
SYS = "You are Grok Bot, an assistant that answers questions about the user's GitHub repos. Use tool results; be concise."
TOOLDEFS = open(os.path.join(_here, "pmll_tool_defs_core.json")).read()
FETCH_DEF = json.dumps({"name":"read_repo_file","description":"Read a file from github.com/drQedwards/pmll","inputSchema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}})
# (question, source doc, keyword for extractive answer)
TOPICS = [
 ("What does memory_silo_t contain?","README.md","memory_silo_t"),
 ("What does init_pml do?","README.md","init_pml"),
 ("What is the Q-promise drain thread-safety rule?","README.md","single-threaded"),
 ("What does peek_semantic match on?","README.md","peek_semantic"),
 ("What eviction does PMMemoryStore use?","docs_codedocs_kv-silo.md","slot"),
 ("Why are stable slot indexes useful?","docs_codedocs_kv-silo.md","stable slot"),
 ("What does resolve_context prefer?","docs_codedocs_architecture.md","resolve_context"),
 ("How are embeddings computed?","docs_codedocs_architecture.md","embeddings.py"),
 ("What is the cache pattern workflow?","docs_codedocs_guides_cache-patterns.md","peek"),
 ("How do I install and run the MCP server?","docs_codedocs_guides_install-and-run.md","install"),
 ("What is pmll-anchor on Stellar?","docs_STELLAR.md","anchor"),
 ("What MCP tools exist?","docs_codedocs_mcp-tools.md","peek"),
 ("How do Q-promises resolve?","docs_codedocs_q-promises.md","resolve"),
 ("What does the semantic memory graph store?","docs_codedocs_semantic-memory-graph.md","node"),
 ("What does the solution engine do on a miss?","docs_codedocs_solution-engine.md","miss"),
 ("What is libqpromise.so?","Q_promise_lib_README.md","libqpromise"),
 ("What is the 3SAT doc about?","docs_THREE_SAT.md","SAT"),
]
def extract(doc, kw, n=6):
    L = DOCS[doc].splitlines()
    i = next((k for k,l in enumerate(L) if kw.lower() in l.lower()), 0)
    return "\n".join(L[max(0,i-1):i+n])
def make_tasks(n_tasks=24, turns=4, seed=7):
    r = random.Random(seed); tasks=[]
    for t in range(n_tasks):
        # related tasks: draw from a small hot set + occasional new topic (repeat lookups within & across tasks)
        hot = r.sample(range(len(TOPICS)), 5)
        tasks.append([TOPICS[r.choice(hot)] for _ in range(turns)])
    return tasks
def run_prompts(tasks, arm, shared=False):
    return run(tasks, arm, shared, keep_prompt=True)
def run(tasks, arm, shared=False, keep_prompt=False):
    rows=[]; store=PMMemoryStore(256) if arm!="A" else None
    for ti,task in enumerate(tasks):
        if arm!="A" and not shared: store=PMMemoryStore(256)
        hist=""; sess=f"task-{ti}"
        for k,(q,doc,kw) in enumerate(task):
            ans=extract(doc,kw); key=f"fact:{doc}:{kw}"
            tooldefs = FETCH_DEF + (TOOLDEFS if arm!="A" else "")
            overhead=0; hit=""
            if arm=="A":
                ctx=f"[tool read_repo_file path={doc}]\n{DOCS[doc]}"
            else:
                peekcall=json.dumps({"tool":"peek","session_id":sess,"key":key})
                h,v,_=store.peek(key)
                if h:
                    hit=1; res=json.dumps({"hit":True,"value":v}); ctx=f"{peekcall}\n{res}"
                    overhead=T(ctx)
                else:
                    hit=0; ctx=f"{peekcall}\n{json.dumps({'hit':False})}\n[tool read_repo_file path={doc}]\n{DOCS[doc]}"
                    setcall=json.dumps({"tool":"set","session_id":sess,"key":key,"value":ans})
                    store.set(key,ans)
                    overhead=T(f"{peekcall}\n{json.dumps({'hit':False})}")+T(setcall)
                    ans_out=ans+"\n"+setcall
            prompt=f"{SYS}\n{tooldefs}\n{hist}\nUser: {q}\n{ctx}"
            out = ans if (arm=="A" or hit==1) else ans_out
            if arm!="A" and hit==0: overhead_out=T(setcall)
            inp=T(prompt); o=T(out)
            rows.append(dict(arm=arm+("-shared" if shared else ("-pertask" if arm!="A" else "")),task=ti,turn=k,question=q,doc=doc,
              cache_hit=hit,input_tokens=inp,output_tokens=o,total_tokens=inp+o,
              tooldef_tokens=T(TOOLDEFS) if arm!="A" else 0,memory_io_tokens=overhead,doc_tokens=T(DOCS[doc])))
            if keep_prompt: rows[-1]['prompt']=prompt
            # history keeps a compact transcript (question + answer), same rule both arms
            hist+=f"User: {q}\nAssistant: {ans}\n"
    return rows
if __name__=="__main__":
    tasks=make_tasks(); rows=run(tasks,"A")+run(tasks,"B")+run(tasks,"B",shared=True)
    with open("raw_turns.csv","w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
    summ={}
    for r in rows: s=summ.setdefault(r["arm"],dict(turns=0,inp=0,out=0,hits=0,lookups=0,tooldef=0,memio=0))
    for r in rows:
        s=summ[r["arm"]]; s["turns"]+=1; s["inp"]+=r["input_tokens"]; s["out"]+=r["output_tokens"]
        s["tooldef"]+=r["tooldef_tokens"]; s["memio"]+=r["memory_io_tokens"]
        if r["cache_hit"]!="": s["lookups"]+=1; s["hits"]+=r["cache_hit"]
    base=summ["A"]["inp"]+summ["A"]["out"]
    with open("summary.csv","w",newline="") as f:
        w=csv.writer(f); w.writerow(["arm","turns","input_tokens","output_tokens","total_tokens","tokens_per_turn","reduction_vs_A_pct","hit_rate_pct","tooldef_overhead_tokens","memory_io_overhead_tokens","overhead_pct_of_arm_total"])
        for a,s in summ.items():
            tot=s["inp"]+s["out"]; hr=100*s["hits"]/s["lookups"] if s["lookups"] else ""
            w.writerow([a,s["turns"],s["inp"],s["out"],tot,round(tot/s["turns"],1),round(100*(base-tot)/base,2),round(hr,2) if hr!="" else "",s["tooldef"],s["memio"],round(100*(s["tooldef"]+s["memio"])/tot,2)])
    print(open("summary.csv").read())
