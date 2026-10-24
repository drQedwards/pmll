"""Real-API version of harness.py: same 96 turns (A, B-pertask, B-shared), but each turn's prompt is
sent to xAI chat/completions and the API-reported usage is recorded. Key read from env XAI_API_KEY (never printed).
Usage: XAI_MODEL=<id> .venv/bin/python harness_xai.py [max_tasks]"""
import os, sys, json, csv, time, urllib.request
import harness as H
KEY=os.environ.get("XAI_API_KEY")
MODEL=os.environ.get("XAI_MODEL","grok-4.7")
URL="https://api.x.ai/v1/responses"
def call(system, user, max_tokens=200):
    body=json.dumps({"model":MODEL,"input":[{"role":"system","content":system},{"role":"user","content":user}],
                     "max_output_tokens":max_tokens}).encode()
    req=urllib.request.Request(URL,body,{"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
    for i in range(4):
        try: return json.load(urllib.request.urlopen(req,timeout=120))
        except urllib.error.HTTPError as e:
            if e.code in (429,500,502,503) and i<3: time.sleep(2**i); continue
            raise RuntimeError(f"HTTP {e.code}: {e.read()[:300]!r}")
def _first(d,*keys):
    for k in keys:
        if isinstance(d,dict) and d.get(k) is not None: return d[k]
    return None
def parse_usage(resp):
    u=resp.get("usage") or {}
    ind=_first(u,"input_tokens_details","prompt_tokens_details") or {}
    outd=_first(u,"output_tokens_details","completion_tokens_details") or {}
    inp=_first(u,"input_tokens","prompt_tokens"); out=_first(u,"output_tokens","completion_tokens")
    return dict(api_input=inp,api_output=out,api_cached=_first(ind,"cached_tokens"),
                api_reasoning=_first(outd,"reasoning_tokens"),
                api_total=_first(u,"total_tokens") or ((inp or 0)+(out or 0)),model=resp.get("model",MODEL))
def main():
    assert KEY, "XAI_API_KEY not set in this process environment"
    n=int(sys.argv[1]) if len(sys.argv)>1 else 24
    tasks=H.make_tasks()[:n]; out=[]
    for arm,shared in (("A",False),("B",False),("B",True)):
        for r in H.run_prompts(tasks,arm,shared):
            r.update(parse_usage(call(H.SYS, r.pop("prompt"))))
            out.append(r)
    with open("raw_turns_xai.csv","w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=out[0].keys()); w.writeheader(); w.writerows(out)
if __name__=="__main__": main()
