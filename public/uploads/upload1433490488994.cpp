#import"bits/stdc++.h"
#define Z(a,b) for(a=0;a<b;++a)
using namespace std;int N,E,Q,G[205][205],F,S,C,X;main(){cin>>N>>E>>Q;Z(F,N)Z(S,N)G[F][S]=F^S?1e9:0;Z(X,E)cin>>F>>S>>C,G[F][S]=G[S][F]=C;Z(F,N)Z(S,N)Z(C,N)G[S][C]=min(G[S][C],G[S][F]+G[F][C]);Z(C,Q)cin>>F>>S,cout<<(G[F][S]-1e9?G[F][S]:-1)<<"\n";}