#include <bits/stdc++.h>
using namespace std;
struct Row{int id,cost,self,party,role=0;};struct G{int flat;vector<int> costs,rates;int layout=-1,freeMask=-1,external=0,externalFront=0,satisfied=0;set<int>banned;};
struct P{int cost=0;array<short,6> a{};array<short,6> rows{};};
struct C{int n=0,nf=0,reward=-1,frontOwn=0;P p;array<unsigned char,20> counts{},freeCounts{};};
vector<Row> rows;vector<G> gs,ss;int R,Gn,Sn,CAP,frontMask=0,frontMin=1,generic=0,rewardPositionMask=63,grand=0;long long nodes=0,rosterCalls=0,emitted=0;vector< vector<C> > bins;using DP=map<tuple<int,int,int,string>,vector<P>>;map<string,DP> cache;
bool dominates(const P&a,const P&b,int n){if(a.cost>b.cost)return false;for(int i=0;i<n;i++)if(a.a[i]<b.a[i])return false;return true;}
void insertP(vector<P>&v,const P&p,int n){for(auto &q:v)if(dominates(q,p,n))return;size_t j=0;for(auto&q:v)if(!dominates(p,q,n))v[j++]=q;v.resize(j);v.push_back(p);}
struct CoeffHash{size_t operator()(const array<short,6>&a)const noexcept{size_t h=0;for(auto x:a)h=h*8191+unsigned(x);return h;}};
 unordered_map<const vector<C>*,unordered_map<array<short,6>,int,CoeffHash>> cSeen;
 void insertC(vector<C>&v,const C&p){auto&seen=cSeen[&v];auto it=seen.find(p.p.a);if(it!=seen.end()&&it->second<=p.p.cost)return;seen[p.p.a]=p.p.cost;for(auto&q:v)if(dominates(q.p,p.p,6))return;size_t j=0;for(auto&q:v)if(!dominates(p.p,q.p,6))v[j++]=q;v.resize(j);v.push_back(p);}
string sigRates(const vector<int>&v){string s;for(auto a:v){s.push_back(a&255);s.push_back(a>>8);}return s;}
DP& roster(vector<int> rates,int nmax,const set<int>&banned={}){
 string key=sigRates(rates);key.push_back(nmax);for(int id:banned)key+=to_string(id)+",";auto it=cache.find(key);if(it!=cache.end())return it->second;rosterCalls++;
 map<int,vector<int>> byid;for(int r=0;r<R;r++){if(banned.count(rows[r].id))continue;auto&ls=byid[rows[r].id];bool lose=false;for(int q:ls)if(rows[q].cost<=rows[r].cost&&rates[q]>=rates[r]){lose=true;break;}if(lose)continue;ls.erase(remove_if(ls.begin(),ls.end(),[&](int q){return rows[r].cost<=rows[q].cost&&rates[r]>=rates[q];}),ls.end());ls.push_back(r);}
 set<int> keep;set<int> costs;for(auto r:rows)costs.insert(r.cost);
 set<int> roles;for(auto r:rows)roles.insert(r.role);
 for(int c:costs)for(int role:roles){vector<pair<int,int>> rank;for(auto&[id,ls]:byid){if(rows[ls[0]].role!=role)continue;int best=-1;for(int r:ls)if(rows[r].cost<=c&&(best<0||rates[r]>rates[best]))best=r;if(best>=0)rank.push_back({-rates[best],id});}sort(rank.begin(),rank.end());for(int i=0;i<min(nmax,(int)rank.size());i++)keep.insert(rank[i].second);}
 vector<pair<int,int>> cheapest;for(auto&[id,ls]:byid){int c=999;for(int r:ls)c=min(c,rows[r].cost);cheapest.push_back({c,id});if(rows[ls[0]].party)keep.insert(id);}sort(cheapest.begin(),cheapest.end());for(int i=0;i<min(nmax,(int)cheapest.size());i++)keep.insert(cheapest[i].second);
 const bool allGrand=grand>1&&rewardPositionMask==63&&!frontMask;
 auto sig=[allGrand](const P&p,int n,int k){string s;if(allGrand){int mask=0,extra=0;for(int i=0;i<n;i++){int cl=rows[p.rows[i]].role>>8;if(cl==8)extra=min(2,extra+1);else mask|=1<<cl;}s.push_back(mask&255);s.push_back(mask>>8);s.push_back(extra);return s;}for(int i=0;i<n-k;i++){int role=rows[p.rows[i]].role;s.push_back(role&255);s.push_back(role>>8);}s.push_back(':');if(grand>1&&!frontMask){int mask=0,extra=0;for(int i=n-k;i<n;i++){int cl=rows[p.rows[i]].role>>8;if(cl==8)extra=min(2,extra+1);else mask|=1<<cl;}s.push_back(mask&255);s.push_back(mask>>8);s.push_back(extra);return s;}for(int i=n-k;i<n;i++){int role=rows[p.rows[i]].role;s.push_back(role&255);s.push_back(role>>8);}return s;};
 DP dp;dp[{0,0,0,""}].push_back(P{});
 for(auto&[id,ls]:byid){if(!keep.count(id))continue;DP next=dp;
  for(auto&[state,list]:dp){auto[n,k,party,roleState]=state;if(n==nmax)continue;int live=n-k;
   for(auto prev:list)for(int r:ls){P p=prev;p.cost+=rows[r].cost;if(p.cost>CAP)continue;int at=live;for(int i=n;i>live;i--)p.rows[i]=p.rows[i-1];while(at>0&&((!allGrand&&rows[p.rows[at-1]].role<rows[r].role)||((allGrand||rows[p.rows[at-1]].role==rows[r].role)&&p.a[at-1]<rates[r]))){p.a[at]=p.a[at-1];p.rows[at]=p.rows[at-1];at--;}p.a[at]=rates[r];p.rows[at]=r;insertP(next[{n+1,k,party+rows[r].party,sig(p,n+1,k)}],p,live+1);
    p=prev;p.cost+=rows[r].cost;p.rows[n]=r;sort(p.rows.begin()+live,p.rows.begin()+n+1,[](int a,int b){return rows[a].role>rows[b].role;});insertP(next[{n+1,k+1,party+rows[r].party,sig(p,n+1,k+1)}],p,live);
   }
  }dp=move(next);
 }
 if(cache.size()>=(grand>1?512:4096))cache.erase(cache.begin());return cache.emplace(key,move(dp)).first->second;
}
// When all reward positions are front seats, only the set of front Grand
// classes matters. Back classes never affect reward eligibility. The DP
// therefore retains front/back rates separately and front class presence.
struct FrontStateHash{size_t operator()(const tuple<int,int,int,int,int,int,int>&t)const noexcept{auto[a,b,c,d,e,f,g]=t;return a|(b<<3)|(c<<6)|(d<<9)|(e<<12)|(f<<15)|(size_t(g)<<18);}};
using FD=unordered_map<tuple<int,int,int,int,int,int,int>,vector<P>,FrontStateHash>;
map<string,FD> frontCache;
FD& frontRoster(const vector<int>&rates,int fc,int bc,int nmax,const set<int>&banned,int minGrand){
 string key=sigRates(rates);key.push_back(fc);key.push_back(bc);key.push_back(nmax);key.push_back(minGrand);for(int id:banned)key+=to_string(id)+",";auto old=frontCache.find(key);if(old!=frontCache.end())return old->second;rosterCalls++;
 map<int,vector<int>> byid;for(int r=0;r<R;r++){if(banned.count(rows[r].id))continue;auto&ls=byid[rows[r].id];if(any_of(ls.begin(),ls.end(),[&](int q){return rows[q].cost<=rows[r].cost&&rates[q]>=rates[r];}))continue;ls.erase(remove_if(ls.begin(),ls.end(),[&](int q){return rows[r].cost<=rows[q].cost&&rates[r]>=rates[q];}),ls.end());ls.push_back(r);}
 set<int>keep,costs,roles;for(auto r:rows){costs.insert(r.cost);roles.insert(r.role);}for(int c:costs)for(int role:roles){vector<pair<int,int>>rank;for(auto&[id,ls]:byid){if(rows[ls[0]].role!=role)continue;int best=-1;for(int r:ls)if(rows[r].cost<=c&&(best<0||rates[r]>rates[best]))best=r;if(best>=0)rank.push_back({-rates[best],id});}sort(rank.begin(),rank.end());for(int j=0;j<min(nmax,(int)rank.size());j++)keep.insert(rank[j].second);}for(auto&[id,ls]:byid)if(rows[ls[0]].party)keep.insert(id);
 FD dp;dp[{0,0,0,0,0,0,0}].push_back(P{});map<int,vector<pair<int,vector<int>>>>classes;for(auto&[id,ls]:byid)if(keep.count(id))classes[rows[ls[0]].role>>8].push_back({id,ls});
 for(auto&[cl,identities]:classes){FD sub;sub[{0,0,0,0,0,0,0}].push_back(P{});
 const int classLimit=min(nmax,nmax-minGrand+(cl==8?2:1));const int frontLimit=min(fc,fc-minGrand+(cl==8?2:1));for(auto&[id,ls]:identities){FD next=sub;for(auto&[st,list]:sub){auto[lf,lb,cf,cb,unused,zero,party]=st;int n=lf+lb+cf+cb;if(n>=classLimit)continue;for(const P&prev:list)for(int r:ls){if(prev.cost+rows[r].cost>CAP)continue;for(int kind=0;kind<4;kind++){bool front=kind<2,live=(kind%2)==0;if(front?lf+cf>=fc||(rewardPositionMask==7&&lf+cf>=frontLimit):lb+cb>=bc)continue;P p=prev;p.cost+=rows[r].cost;int a=lf,b=lb,c=cf,d=cb;
 if(front){if(live){for(int j=lf+cf;j>lf;j--)p.rows[j]=p.rows[j-1];int at=lf;while(at>0&&p.a[at-1]<rates[r]){p.a[at]=p.a[at-1];p.rows[at]=p.rows[at-1];at--;}p.a[at]=rates[r];p.rows[at]=r;a++;}else{p.rows[lf+cf]=r;c++;}}
 else {if(live){for(int j=3+lb+cb;j>3+lb;j--)p.rows[j]=p.rows[j-1];int at=3+lb;while(at>3&&p.a[at-1]<rates[r]){p.a[at]=p.a[at-1];p.rows[at]=p.rows[at-1];at--;}p.a[at]=rates[r];p.rows[at]=r;b++;}else{p.rows[3+lb+cb]=r;d++;}}
 insertP(next[{a,b,c,d,0,0,party+rows[r].party}],p,6);
 }}}sub=move(next);}
 FD next=dp;for(auto&[a,ps]:dp)for(auto&[b,qs]:sub){auto[lf,lb,cf,cb,available,zero,party]=a;auto[xf,xb,yf,yb,none,none2,ownparty]=b;if(xf+xb+yf+yb==0)continue;int f=lf+xf,back=lb+xb,capf=cf+yf,capb=cb+yb;if(f+capf>fc||back+capb>bc||f+back+capf+capb>nmax)continue;int taken=rewardPositionMask==63?xf+xb+yf+yb:xf+yf,grant=min(grand,available+min(cl==8?2:1,taken));if(grant+(rewardPositionMask==63?nmax-f-back-capf-capb:fc-f-capf)<minGrand)continue;
 auto&dest=next[{f,back,capf,capb,grant,0,party+ownparty}];for(auto&p:ps)for(auto&q:qs){P r;r.cost=p.cost+q.cost;if(r.cost>CAP)continue;int i=0,j=0;for(int at=0;at<f;at++){bool pick=i<lf&&(j>=xf||p.a[i]>=q.a[j]);r.a[at]=pick?p.a[i]:q.a[j];r.rows[at]=pick?p.rows[i++]:q.rows[j++];}i=j=0;for(int at=0;at<back;at++){bool pick=i<lb&&(j>=xb||p.a[3+i]>=q.a[3+j]);r.a[3+at]=pick?p.a[3+i]:q.a[3+j];r.rows[3+at]=pick?p.rows[3+i++]:q.rows[3+j++];}int at=f;for(int z=0;z<cf;z++)r.rows[at++]=p.rows[lf+z];for(int z=0;z<yf;z++)r.rows[at++]=q.rows[xf+z];at=3+back;for(int z=0;z<cb;z++)r.rows[at++]=p.rows[3+lb+z];for(int z=0;z<yb;z++)r.rows[at++]=q.rows[3+xb+z];insertP(dest,r,6);}}

 dp=move(next);}
 if(frontCache.size()>=size_t(getenv("FRONT_CACHE_LIMIT")?atoi(getenv("FRONT_CACHE_LIMIT")):512))frontCache.erase(frontCache.begin());return frontCache.emplace(key,move(dp)).first->second;
}
int guestMax=0,layoutMask=7,ownMin=1,ownMax=6,totalMin=1,totalMax=6;
int binId(int layout,int si,int ownFlat,int n,int nf,int k,int guest){return ((((((layout*Sn+si)*13+ownFlat)*7+n)*4+nf)*7+k)*2+guest);}
void evaluate(const vector<int>&rate,int flat,int cost,int equipped,array<unsigned char,20>&counts,int reward=-1,array<unsigned char,20>freeCounts={}){
 const bool autoFree=grand>1;int freeCount=autoFree?min(grand,equipped):(reward>=0?1:accumulate(freeCounts.begin(),freeCounts.end(),0));
 vector<pair<int,int>> freeItems;if(autoFree){for(int j=0;j<Gn;j++)for(int k=0;k<counts[j];k++)freeItems.push_back({gs[j].costs[k],j});sort(freeItems.rbegin(),freeItems.rend());}
 for(int layout=0;layout<3;layout++)for(int si=0;si<Sn;si++){
  if(!(layoutMask&(1<<layout))||(layout==0&&si&&!generic)||ss[si].layout>=0&&ss[si].layout!=layout)continue;auto&sup=ss[si];int ext=generic?sup.external:(layout?1:0),seats=generic?__builtin_popcount((unsigned)sup.freeMask):(layout==0?6:5),nmax=min({seats,ownMax,totalMax-ext}),fc=generic?__builtin_popcount((unsigned)(sup.freeMask&7)):(layout==2?2:3),bc=seats-fc;
  if(equipped-freeCount>nmax)continue;vector<int> combined(R);int off=INT_MAX;for(int r=0;r<R;r++){combined[r]=rate[r]+ss[si].rates[r]+rows[r].self;off=min(off,combined[r]);}if(!R)off=0;for(int&r:combined)r-=off;
  if(grand>1&&(rewardPositionMask==7||rewardPositionMask==63)&&generic&&!frontMask){int need=max(0,equipped-nmax);if(need>min(grand,rewardPositionMask==7?fc:nmax))continue;auto&dp=frontRoster(combined,fc,bc,nmax,sup.banned,need);for(auto&[st,list]:dp){auto[lf,lb,cf,cb,mask,extra,party]=st;int n=lf+lb+cf+cb,k=cf+cb,available=mask,used=min({available,grand,equipped});if(n<ownMin||n+ext<totalMin||(n==k&&n>0)||equipped-used>n||lf+cf+sup.externalFront<frontMin)continue;for(auto p:list)for(int guest=0;guest<(layout&&guestMax?2:1);guest++){C c;c.n=n;c.nf=lf;c.frontOwn=lf+cf;c.counts=counts;c.p=p;c.p.cost+=cost;for(int j=0;j<used;j++){c.p.cost-=freeItems[j].first;c.freeCounts[freeItems[j].second]++;}if(c.p.cost>CAP)continue;for(int i=0;i<lf;i++)c.p.a[i]+=1000+off+party+250*k+guest*guestMax;for(int i=3;i<3+lb;i++)c.p.a[i]+=1000+off+party+250*k+guest*guestMax;insertC(bins[binId(layout,si,flat/50,n,lf,k,guest)],c);emitted++;}}continue;}
  auto&dp=roster(combined,nmax,sup.banned);
  for(auto&[state,list]:dp){auto[n,k,party,roleState]=state;if(n<max({equipped-freeCount,ownMin,totalMin-ext})||(k==n&&n>0))continue;for(auto p:list){
   p.cost+=cost;if(p.cost>CAP+(autoFree?grand*12:0))continue;for(int guest=0;guest<(layout&&guestMax?2:1);guest++){
   P q=p;for(int i=0;i<n-k;i++)q.a[i]+=1000+off+party+250*k+guest*guestMax;
   for(int mask=0;mask<(1<<(n-k));mask++){int nf=__builtin_popcount((unsigned)mask),nb=n-k-nf;if(nf>fc||nb>bc||n>fc+bc)continue;for(int cm=0;cm<((frontMask||(generic&&grand>1&&rewardPositionMask!=63))?(1<<k):1);cm++){C c;c.n=n;c.nf=nf;c.reward=reward;c.counts=counts;c.freeCounts=freeCounts;c.p.cost=q.cost;int f=0,b=3;for(int i=0;i<n-k;i++){int at=(mask&(1<<i))?f++:b++;c.p.a[at]=q.a[i];c.p.rows[at]=q.rows[i];}
    // Fill free seats with the capped aura carriers; they earn zero bond.
    bool legal=true;for(int i=n-k;i<n;i++){bool front=(frontMask||(generic&&grand>1&&rewardPositionMask!=63))?bool(cm&(1<<(i-(n-k)))):f<fc;if((front&&f>=fc)||(!front&&b>=3+bc)){legal=false;break;}int at=front?f++:b++;c.p.rows[at]=q.rows[i];}if(!legal)continue;
    if(f+(generic?sup.externalFront:(layout==2))<frontMin)continue;int frontRole=sup.satisfied;for(int i=0;i<f;i++)frontRole|=(rows[c.p.rows[i]].role&255);if((frontRole&frontMask)!=frontMask)continue;
    if(freeCount&&generic&&grand){map<int,int>classes;int available=0;vector<int>frontSeats,backSeats;for(int i=0;i<6;i++)if(sup.freeMask&(1<<i))(i<3?frontSeats:backSeats).push_back(i);for(int i=0;i<n;i++){int at=i<f?i:3+i-f,position=i<f?frontSeats[i]:backSeats[i-f];if(!(rewardPositionMask&(1<<position)))continue;if(grand==1)available++;else{int cl=rows[c.p.rows[at]].role>>8;classes[cl]=min(cl==8?2:1,classes[cl]+1);}}if(grand>1)for(auto [cl,count]:classes)available+=count;if(autoFree){int used=min({available,grand,equipped});if(equipped-used>n)continue;c.freeCounts={};for(int j=0;j<used;j++){c.p.cost-=freeItems[j].first;c.freeCounts[freeItems[j].second]++;}if(c.p.cost>CAP)continue;}else if(available<freeCount)continue;}
    c.frontOwn=f;insertC(bins[binId(layout,si,flat/50,n,nf,k,guest)],c);emitted++;}
   }
   }
  }}
 }
}
void walk(int g,int remaining,int flat,int cost,int equipped,vector<int>&rate,array<unsigned char,20>&counts){nodes++;if(nodes%16384==0)cerr<<"progress nodes="<<nodes<<" roster="<<rosterCalls<<" emitted="<<emitted<<"\n";if(cost>CAP+grand*12)return;if(g==Gn||!remaining){if(grand>1&&equipped){evaluate(rate,flat,cost,equipped,counts);}else if(grand&&equipped){if(generic&&cost<=CAP)evaluate(rate,flat,cost,equipped,counts);int best=-1,saved=-1;for(int j=0;j<Gn;j++)if(counts[j]&&gs[j].costs[counts[j]-1]>saved){best=j;saved=gs[j].costs[counts[j]-1];}if(cost-saved<=CAP)evaluate(rate,flat,cost-saved,equipped,counts,best);}else if(cost<=CAP)evaluate(rate,flat,cost,equipped,counts);return;}auto &group=gs[g];if(!group.flat&&all_of(group.rates.begin(),group.rates.end(),[](int r){return r==0;})){counts[g]=0;walk(g+1,remaining,flat,cost,equipped,rate,counts);return;}int limit=min(remaining,(int)group.costs.size());if(!group.flat&&limit)for(int j=0;j<g;j++){const auto&better=gs[j];if(better.flat||counts[j]>=better.costs.size()||better.costs[counts[j]]>group.costs[0])continue;bool covers=true;for(int r=0;r<R;r++)if(better.rates[r]<group.rates[r]){covers=false;break;}if(covers){limit=0;break;}}
 int c=0;for(int k=0;k<=limit;k++){counts[g]=k;walk(g+1,remaining-k,flat+k*group.flat,cost+c,equipped+k,rate,counts);if(k<(int)group.costs.size())c+=group.costs[k];for(int r=0;r<R;r++)rate[r]+=group.rates[r];}int m=limit+1;for(int r=0;r<R;r++)rate[r]-=m*group.rates[r];counts[g]=0;
 if(g==0||g==1)cerr<<"nodes "<<nodes<<" roster "<<rosterCalls<<" cache "<<cache.size()<<" emitted "<<emitted<<"\n";
}
int main(int argc,char**argv){ifstream in(argv[1]);string header;getline(in,header);istringstream head(header);head>>R>>Gn>>Sn>>CAP>>guestMax>>grand>>layoutMask>>ownMin>>ownMax>>totalMin>>totalMax;head>>frontMask>>generic>>frontMin;head>>rewardPositionMask;rows.resize(R);for(auto&r:rows){in>>r.id>>r.cost>>r.self>>r.party;if(frontMask||generic)in>>r.role;}gs.resize(Gn);ss.resize(Sn);for(auto&g:gs){int n;in>>g.flat>>n;g.costs.resize(n);for(auto&c:g.costs)in>>c;g.rates.resize(R);for(auto&r:g.rates)in>>r;}for(auto&s:ss){in>>s.flat;s.rates.resize(R);for(auto&r:s.rates)in>>r;if(generic){int count;in>>s.layout>>s.freeMask>>s.external>>s.externalFront>>s.satisfied>>count;for(int i=0,id;i<count;i++){in>>id;s.banned.insert(id);}}}
 bins.resize(3*Sn*13*7*4*7*2);vector<int> rate(R);array<unsigned char,20>counts{};int maxOwn=min(ownMax,totalMax-((layoutMask&1)?0:1));if(generic){maxOwn=0;for(auto s:ss)maxOwn=max(maxOwn,min({ownMax,totalMax-s.external,__builtin_popcount((unsigned)s.freeMask)}));}walk(0,maxOwn+min(grand,maxOwn),0,0,0,rate,counts);

 cSeen.clear();vector<vector<C>> reduced(bins.size());long long before=0;
 for(int layout=0;layout<3;layout++)for(int si=0;si<Sn;si++)for(int flat=0;flat<13;flat++)for(int n=0;n<7;n++)for(int nf=0;nf<4;nf++)for(int k=0;k<max(1,n);k++)for(int guest=0;guest<2;guest++)for(auto&c:bins[binId(layout,si,flat,n,nf,k,guest)]){before++;insertC(reduced[binId(layout,si,flat,0,0,k,guest)],c);}
 bins=move(reduced);cerr<<"reduced from "<<before<<"\n";
 ofstream out(argv[2]);long long saved=0;for(int layout=0;layout<3;layout++)for(int si=0;si<Sn;si++)for(int flat=0;flat<13;flat++)for(int k=0;k<6;k++)for(int guest=0;guest<2;guest++)for(auto&c:bins[binId(layout,si,flat,0,0,k,guest)]){int n=c.n,nf=c.nf;out<<layout<<' '<<si<<' '<<flat<<' '<<n<<' '<<nf<<' '<<k<<' '<<guest<<' '<<c.p.cost;for(auto a:c.p.a)out<<' '<<a;for(auto r:c.p.rows)out<<' '<<r;for(int g=0;g<Gn;g++)out<<' '<<int(c.counts[g]);out<<' '<<c.reward;if(grand>1)for(int g=0;g<Gn;g++)out<<' '<<int(c.freeCounts[g]);if(generic)out<<' '<<c.frontOwn;out<<'\n';saved++;}cerr<<"DONE nodes="<<nodes<<" roster="<<rosterCalls<<" emitted="<<emitted<<" saved="<<saved<<"\n";
}
