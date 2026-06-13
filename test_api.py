import urllib.request, json, os

data = open('data/generated/sample_phase1_event.json', 'rb').read()
req = urllib.request.Request(
    'http://localhost:8000/run-simulation',
    data=data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
print('POSTing to /run-simulation...')
resp = urllib.request.urlopen(req, timeout=180)
body = resp.read().decode()
obj = json.loads(body)

print('HTTP status:', resp.status)
print('event_id:', obj.get('event_id'))
print('days:', obj.get('days'))

p = obj.get('profile', {})
print('\nProfile:')
for k, v in p.items():
    print(f'  {k}: {v}')

nodes = obj.get('nodes', [])
print(f'\nNodes count: {len(nodes)}')
print(f'Edges count: {len(obj.get("edges", []))}')
print(f'Lockdown recs count: {len(obj.get("lockdown_recommendations", []))}')

print('\nTop 5 nodes by peak_I_p50:')
for n in nodes[:5]:
    nid = n["node_id"]
    name = n["name"]
    peak_day = n["peak_infection_day"]
    peak_I = n["peak_I_p50"]
    overwhelmed = n["overwhelmed"]
    print(f'  {nid:7s}  {name:<22s}  peak_day={peak_day:3d}  peak_I={peak_I:>12,}  overwhelmed={overwhelmed}')

print('\nTop 5 lockdown recs:')
for i, r in enumerate(obj.get('lockdown_recommendations', [])[:5], 1):
    src = r["source_name"]
    tgt = r["target_name"]
    score = r["combined_score"]
    modes = r["modes"]
    print(f'  {i}. {src} <-> {tgt}  score={score:.4f}  modes={modes}')

print('\nOutput files:')
for k, v in obj.get('output_files', {}).items():
    print(f'  {k}: {os.path.basename(v)}')
