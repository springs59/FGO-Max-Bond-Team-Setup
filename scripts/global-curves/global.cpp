#include <bits/stdc++.h>
using namespace std;
struct Row{int id,cost,self,party;};struct G{int flat;vector<int> costs,rates;};
struct P{int cost=0;array<short,6> a{};array<short,6> rows{};};
struct C{int n=0,nf=0;P p;array<unsigned char,20> counts{};};
vector<Row> rows;vector<G> gs,ss;int R,Gn,Sn,CAP;long long nodes=0,rosterCalls=0,emitted=0;vector< vector<C> > bins;using DP=map<tuple<int,int,int>,vector<P>>;map<string,DP> cache;
bool dominates(const P&a,const P&b,int n){if(a.cost>b.cost)return false;for(int i=0;i<n;i++)if(a.a[i]<b.a[i])return false;return true;}
void insertP(vector<P>&v,const P&p,int n){for(auto &q:v)if(dominates(q,p,n))return;size_t j=0;for(auto&q:v)if(!dominates(p,q,n))v[j++]=q;v.resize(j);v.push_back(p);}
void insertC(vector<C>&v,const C&p){for(auto&q:v)if(dominates(q.p,p.p,6))return;size_t j=0;for(auto&q:v)if(!dominates(p.p,q.p,6))v[j++]=q;v.resize(j);v.push_back(p);}
string sigRates(const vector<int>&v){string s;for(auto a:v){s.push_back(a&255);s.push_back(a>>8);}return s;}
DP& roster(vector<int> rates,int nmax){
 string key=sigRates(rates);key.push_back(nmax);auto it=cache.find(key);if(it!=cache.end())return it->second;rosterCalls++;
 map<int,vector<int>> byid;for(int r=0;r<R;r++){auto&ls=byid[rows[r].id];bool lose=false;for(int q:ls)if(rows[q].cost<=rows[r].cost&&rates[q]>=rates[r]){lose=true;break;}if(lose)continue;ls.erase(remove_if(ls.begin(),ls.end(),[&](int q){return rows[r].cost<=rows[q].cost&&rates[r]>=rates[q];}),ls.end());ls.push_back(r);}
 set<int> keep;set<int> costs;for(auto r:rows)costs.insert(r.cost);
 for(int c:costs){vector<pair<int,int>> rank;for(auto&[id,ls]:byid){int best=-1;for(int r:ls)if(rows[r].cost<=c&&(best<0||rates[r]>rates[best]))best=r;if(best>=0)rank.push_back({-rates[best],id});}sort(rank.begin(),rank.end());for(int i=0;i<min(nmax,(int)rank.size());i++)keep.insert(rank[i].second);}
 vector<pair<int,int>> cheapest;for(auto&[id,ls]:byid){int c=999;for(int r:ls)c=min(c,rows[r].cost);cheapest.push_back({c,id});if(rows[ls[0]].party)keep.insert(id);}sort(cheapest.begin(),cheapest.end());for(int i=0;i<min(nmax,(int)cheapest.size());i++)keep.insert(cheapest[i].second);
 DP dp;dp[{0,0,0}].push_back(P{});
 for(auto&[id,ls]:byid){if(!keep.count(id))continue;DP next=dp;
  for(auto&[state,list]:dp){auto[n,k,party]=state;if(n==nmax)continue;int live=n-k;
   for(auto prev:list)for(int r:ls){P p=prev;p.cost+=rows[r].cost;if(p.cost>CAP)continue;int at=live;for(int i=n;i>live;i--)p.rows[i]=p.rows[i-1];while(at>0&&p.a[at-1]<rates[r]){p.a[at]=p.a[at-1];p.rows[at]=p.rows[at-1];at--;}p.a[at]=rates[r];p.rows[at]=r;insertP(next[{n+1,k,party+rows[r].party}],p,live+1);
    p=prev;p.cost+=rows[r].cost;p.rows[n]=r;insertP(next[{n+1,k+1,party+rows[r].party}],p,live);
   }
  }dp=move(next);
 }
 return cache.emplace(key,move(dp)).first->second;
}
int guestMax=0;
int binId(int layout,int si,int ownFlat,int n,int nf,int k,int guest){return ((((((layout*Sn+si)*7+ownFlat)*7+n)*4+nf)*7+k)*2+guest);}
void evaluate(const vector<int>&rate,int flat,int cost,int equipped,array<unsigned char,20>&counts){
 for(int layout=0;layout<3;layout++)for(int si=0;si<Sn;si++){
  if(layout==0&&si)continue;int nmax=layout==0?6:5,fc=layout==2?2:3,bc=nmax-fc;
  if(equipped>nmax)continue;vector<int> combined(R);int off=INT_MAX;for(int r=0;r<R;r++){combined[r]=rate[r]+ss[si].rates[r]+rows[r].self;off=min(off,combined[r]);}for(int&r:combined)r-=off;
  auto&dp=roster(combined,nmax);
  for(auto&[state,list]:dp){auto[n,k,party]=state;if(n<max(1,equipped)||k==n)continue;for(auto p:list){
   p.cost+=cost;if(p.cost>CAP)continue;for(int guest=0;guest<(layout&&guestMax?2:1);guest++){
   P q=p;for(int i=0;i<n-k;i++)q.a[i]+=1000+off+party+250*k+guest*guestMax;
   for(int mask=0;mask<(1<<(n-k));mask++){int nf=__builtin_popcount((unsigned)mask),nb=n-k-nf;if(nf>fc||nb>bc||n>fc+bc)continue;C c;c.n=n;c.nf=nf;c.counts=counts;c.p.cost=q.cost;int f=0,b=3;for(int i=0;i<n-k;i++){int at=(mask&(1<<i))?f++:b++;c.p.a[at]=q.a[i];c.p.rows[at]=q.rows[i];}
    // Fill free seats with the capped aura carriers; they earn zero bond.
    for(int i=n-k;i<n;i++){int at=f<fc?f++:b++;c.p.rows[at]=q.rows[i];}
    insertC(bins[binId(layout,si,flat/50,n,nf,k,guest)],c);emitted++;
   }
   }
  }}
 }
}
void walk(int g,int remaining,int flat,int cost,int equipped,vector<int>&rate,array<unsigned char,20>&counts){nodes++;if(cost>CAP)return;if(g==Gn||!remaining){evaluate(rate,flat,cost,equipped,counts);return;}auto &group=gs[g];int c=0;for(int k=0;k<=min(remaining,(int)group.costs.size());k++){counts[g]=k;walk(g+1,remaining-k,flat+k*group.flat,cost+c,equipped+k,rate,counts);if(k<(int)group.costs.size())c+=group.costs[k];for(int r=0;r<R;r++)rate[r]+=group.rates[r];}int m=min(remaining,(int)group.costs.size())+1;for(int r=0;r<R;r++)rate[r]-=m*group.rates[r];counts[g]=0;
 if(g==0||g==1)cerr<<"nodes "<<nodes<<" roster "<<rosterCalls<<" cache "<<cache.size()<<" emitted "<<emitted<<"\n";
}
int main(int argc,char**argv){ifstream in(argv[1]);in>>R>>Gn>>Sn>>CAP>>guestMax;rows.resize(R);for(auto&r:rows)in>>r.id>>r.cost>>r.self>>r.party;gs.resize(Gn);ss.resize(Sn);for(auto&g:gs){int n;in>>g.flat>>n;g.costs.resize(n);for(auto&c:g.costs)in>>c;g.rates.resize(R);for(auto&r:g.rates)in>>r;}for(auto&s:ss){in>>s.flat;s.rates.resize(R);for(auto&r:s.rates)in>>r;}
 bins.resize(3*Sn*7*7*4*7*2);vector<int> rate(R);array<unsigned char,20>counts{};walk(0,6,0,0,0,rate,counts);

 vector<vector<C>> reduced(bins.size());long long before=0;
 for(int layout=0;layout<3;layout++)for(int si=0;si<Sn;si++)for(int flat=0;flat<7;flat++)for(int n=1;n<7;n++)for(int nf=0;nf<4;nf++)for(int k=0;k<n;k++)for(int guest=0;guest<2;guest++)for(auto&c:bins[binId(layout,si,flat,n,nf,k,guest)]){before++;insertC(reduced[binId(layout,si,flat,0,0,k,guest)],c);}
 bins=move(reduced);cerr<<"reduced from "<<before<<"\n";
 ofstream out(argv[2]);long long saved=0;for(int layout=0;layout<3;layout++)for(int si=0;si<Sn;si++)for(int flat=0;flat<7;flat++)for(int k=0;k<6;k++)for(int guest=0;guest<2;guest++)for(auto&c:bins[binId(layout,si,flat,0,0,k,guest)]){int n=c.n,nf=c.nf;out<<layout<<' '<<si<<' '<<flat<<' '<<n<<' '<<nf<<' '<<k<<' '<<guest<<' '<<c.p.cost;for(auto a:c.p.a)out<<' '<<a;for(auto r:c.p.rows)out<<' '<<r;for(int g=0;g<Gn;g++)out<<' '<<int(c.counts[g]);out<<'\n';saved++;}cerr<<"DONE nodes="<<nodes<<" roster="<<rosterCalls<<" emitted="<<emitted<<" saved="<<saved<<"\n";
}
