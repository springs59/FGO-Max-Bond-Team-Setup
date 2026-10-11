"""Independent literal identity/form/CE/placement/capped-state enumeration."""
import itertools, subprocess, tempfile, json, pathlib, sys
native=sys.argv[1]
checks=0
for seed in range(4):
    rows=[(1,0,0,0),(2,3,200,50 if seed%2 else 0),(2,4,500,50 if seed%2 else 0),(3,4,0,0),(4,7,0,0)]
    groups=[(0,[2],[100]*5),(50,[1,1],[0]*5),(0,[2],[0,200,0,200,200])]
    supports=[(0,[0]*5),(0,[150]*5),(50,[0]*5)]
    with tempfile.TemporaryDirectory() as tmp:
        inp=pathlib.Path(tmp)/'input';out=pathlib.Path(tmp)/'output'
        lines=[f'{len(rows)} {len(groups)} {len(supports)} 30 0']
        lines+=[' '.join(map(str,r)) for r in rows]
        lines+=[' '.join(map(str,[f,len(cs),*cs,*rates])) for f,cs,rates in groups]
        lines+=[' '.join(map(str,[f,*rates])) for f,rates in supports]
        inp.write_text('\n'.join(lines));subprocess.run([native,str(inp),str(out)],check=True,capture_output=True)
        bank=[list(map(int,s.split())) for s in out.read_text().splitlines()]
    bases=[0,1,2,3,9,49,249,250,251,499,500,999,1000,2000,10000]
    queries=[(b,c,k,layout,si,pc) for b in bases for c in [0,4,8,14,22,30] for k in range(4) for layout in range(3) for si in (range(3) if layout else [0]) for pc in [0,1,6]]
    expected={q:(0,0) for q in queries}
    # Grouped literal identity choices retain BOTH forms, and capped/eligible states.
    identity_choices=[[None,(0,False),(0,True)],[None,(1,False),(1,True),(2,False),(2,True)],[None,(3,False),(3,True)],[None,(4,False),(4,True)]]
    for team in itertools.product(*identity_choices):
        team=[x for x in team if x is not None];n=len(team)
        if not n:continue
        k=sum(cap for _,cap in team)
        if k==n:continue
        for counts in itertools.product(*[range(len(g[1])+1) for g in groups]):
            if sum(counts)>n:continue
            ce_cost=sum(sum(g[1][:count]) for g,count in zip(groups,counts))
            cost=ce_cost+sum(rows[r][1] for r,cap in team)
            flat=sum(g[0]*count for g,count in zip(groups,counts))
            party=sum(rows[r][3] for r,cap in team)
            for layout in range(3):
                fc=2 if layout==2 else 3;bc=3 if layout==0 or layout==2 else 2
                if n>fc+bc:continue
                for si in (range(3) if layout else [0]):
                    for mask in range(1<<n):
                        nf=mask.bit_count()
                        if nf>fc or n-nf>bc:continue
                        for base in bases:
                            value=0
                            for i,(r,cap) in enumerate(team):
                                if cap:continue
                                first=(1240 if layout==2 else 1200) if mask&(1<<i) else (1040 if layout==2 else 1000)
                                second=1000+rows[r][2]+party+250*k+supports[si][1][r]+sum(g[2][r]*count for g,count in zip(groups,counts))
                                value+=(base*first//1000)*second//1000+flat+supports[si][0]
                            for c in [0,4,8,14,22,30]:
                                if cost>c:continue
                                for pc in [0,1,6]:
                                    if flat//50>pc:continue
                                    q=(base,c,k,layout,si,pc);old=expected[q]
                                    if value>old[0] or value==old[0] and cost<old[1]:expected[q]=(value,cost)
    for q in queries:
        base,c,k,layout,si,pc=q;best=(0,0)
        for p in bank:
            if p[0]!=layout or p[1]!=si or p[5]!=k or p[2]>pc or p[7]>c:continue
            value=0
            for i,second in enumerate(p[8:14]):
                if not second:continue
                first=(1240 if layout==2 else 1200) if i<3 else (1040 if layout==2 else 1000)
                value+=(base*first//1000)*second//1000+50*p[2]+supports[si][0]
            if value>best[0] or value==best[0] and p[7]<best[1]:best=(value,p[7])
        assert best==expected[q],(seed,q,best,expected[q])
        checks+=1
print(json.dumps({'literalDifferentialQueries':checks,'seeds':4,'passed':True}))
