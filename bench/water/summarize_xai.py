"""Summarize raw_turns_xai.csv (API-reported usage) -> summary_xai.csv + water_xai.csv.
Water ASSUMPTION: energy scales with total API tokens (input+output, reasoning included in output);
arm A tokens/turn = one baseline query at scenario Wh/query. Cached input reported separately (also
shown as an 'uncached-only' variant, assuming cached tokens cost ~0 energy, an upper bound on cache benefit)."""
import csv,collections
S={"low":(0.24,1.15),"mid":(0.24,0.55+1.17*3.142),"high":(3.0,1.63+1.18*4.959)}
num=lambda v: float(v) if v not in ("",None,"None") else 0.0
R=list(csv.DictReader(open("raw_turns_xai.csv")))
agg=collections.OrderedDict()
for r in R:
    s=agg.setdefault(r["arm"],collections.Counter())
    s["turns"]+=1; s["inp"]+=num(r["api_input"]); s["out"]+=num(r["api_output"]); s["cached"]+=num(r["api_cached"])
    s["reason"]+=num(r["api_reasoning"]); s["tooldef"]+=num(r["tooldef_tokens"]); s["memio"]+=num(r["memory_io_tokens"])
    if r["cache_hit"]!="": s["lookups"]+=1; s["hits"]+=num(r["cache_hit"])
A=agg["A"]; At=(A["inp"]+A["out"])/A["turns"]; Au=(A["inp"]-A["cached"]+A["out"])/A["turns"]
summ=[]
for arm,s in agg.items():
    tot=(s["inp"]+s["out"])/s["turns"]; unc=(s["inp"]-s["cached"]+s["out"])/s["turns"]
    summ.append(dict(arm=arm,turns=int(s["turns"]),api_input=int(s["inp"]),api_output=int(s["out"]),api_reasoning=int(s["reason"]),
      api_cached=int(s["cached"]),cached_pct_of_input=round(100*s["cached"]/s["inp"],2) if s["inp"] else 0,
      tokens_per_turn=round(tot,1),reduction_vs_A_pct=round(100*(At-tot)/At,2),
      uncached_tokens_per_turn=round(unc,1),uncached_reduction_vs_A_pct=round(100*(Au-unc)/Au,2) if Au else 0,
      hit_rate_pct=round(100*s["hits"]/s["lookups"],2) if s["lookups"] else "",
      overhead_tiktoken_tooldef=int(s["tooldef"]),overhead_tiktoken_memio=int(s["memio"]),
      _ratio=tot/At,_uratio=unc/Au if Au else 0))
with open("summary_xai.csv","w",newline="") as f:
    k=[x for x in summ[0] if not x.startswith("_")]; w=csv.DictWriter(f,k,extrasaction="ignore"); w.writeheader(); w.writerows(summ)
with open("water_xai.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["scenario","Wh_per_baseline_query","L_per_kWh","arm","liters_per_1M_all_tokens","liters_per_1M_uncached_only"])
    for n,(wh,l) in S.items():
        for s in summ: w.writerow([n,wh,round(l,3),s["arm"],round(1e6*wh*s["_ratio"]/1000*l,1),round(1e6*wh*s["_uratio"]/1000*l,1)])
for fn in ("summary_xai.csv","water_xai.csv"): print(open(fn).read())
