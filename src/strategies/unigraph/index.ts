import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';

const UNISWAP_SUBGRAPH_URL = {
  1: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
};

export async function strategy(network, provider, addresses, options, snapshot) {
  const params = {
    users: {
      __args: {
        where: {
          id_in: addresses.map(address => address.toLowerCase())
        },
        first: 10,
      },
      id : true,
      liquidityPositions : {
        __args : {
          where : {
            liquidityTokenBalance_gt : 0
          }
        },
        liquidityTokenBalance  : true,
        pair : {
          id : true,
          token0 : {
            id : true
          },
          reserve0 : true,
          token1 : {
            id : true
          },
          reserve1 : true,
          totalSupply : true
        }  
      }
    }
  };
  if (snapshot !== 'latest') {
    // @ts-ignore
    params.poolShares.__args.block = { number: snapshot };
  }
  const tokenAddress = options.address.toLowerCase();
  const result = await subgraphRequest(UNISWAP_SUBGRAPH_URL[network], params);
  const score = {};
  if (result && result.users) {
    result.users.forEach(u => {
      u.liquidityPositions.filter(lp => 
        lp.pair.token0.id == tokenAddress 
        || lp.pair.token1.id == tokenAddress)
                          .forEach(lp => {
        const token0perUni = lp.pair.reserve0 / lp.pair.totalSupply;
        const token1perUni = lp.pair.reserve1 / lp.pair.totalSupply;
        const userScore = (lp.pair.token0.id == tokenAddress)
            ? token0perUni * lp.liquidityTokenBalance
            : token1perUni * lp.liquidityTokenBalance;

        const userAddress = getAddress(u.id);
        if (!score[userAddress]) score[userAddress] = 0;
        score[userAddress] = score[userAddress] + userScore;
      });
    });
  }
  return score || {};
}