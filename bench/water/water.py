# Converts measured token totals to water. ASSUMPTION: energy scales linearly with total tokens,
# and arm-A's tokens/turn corresponds to one "query" at the scenario Wh/query.
import csv
S={"low":(0.24,1.15),"mid":(0.24,0.55+1.17*3.142),"high":(3.0,1.63+1.18*4.959)}
rows=list(csv.DictReader(open("summary.csv"))); a=float(rows[0]["tokens_per_turn"])
out=[]
for name,(wh,lkwh) in S.items():
  for r in rows:
    ratio=float(r["tokens_per_turn"])/a; L=1e6*wh*ratio/1000*lkwh
    out.append([name,wh,round(lkwh,3),r["arm"],round(ratio,4),round(L,1)])
w=csv.writer(open("water.csv","w",newline="")); w.writerow(["scenario","Wh_per_baseline_query","L_per_kWh","arm","energy_ratio_vs_A","liters_per_1M_queries"]); w.writerows(out)
print(open("water.csv").read())
