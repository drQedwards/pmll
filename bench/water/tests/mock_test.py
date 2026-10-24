import sys,json,random,io; import os; _d=os.path.join(os.path.dirname(os.path.abspath(__file__)),".."); sys.path.insert(0,_d); os.chdir(_d)
os.environ["XAI_API_KEY"]="mock"; import harness_xai as X
v=[0]
def fake(system,user,max_tokens=200):
    v[0]^=1; n=len(user)//4
    return ({"model":"grok-4.7","usage":{"input_tokens":n,"output_tokens":50,"total_tokens":n+50,
        "input_tokens_details":{"cached_tokens":n//3},"output_tokens_details":{"reasoning_tokens":20}}} if v[0] else
        {"usage":{"prompt_tokens":n,"completion_tokens":50,"prompt_tokens_details":{"cached_tokens":0}}})
X.call=fake; X.main()
