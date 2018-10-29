const axios = require('axios');
const database = require('./database');

const config = { base_uri: 'https://api.github.com', api_version: 'v4' };

const request = axios.create({
  baseURL: `${ config.base_uri }`,
  timeout: 5000,
});

// uses github's GraphQL API
const search = async function(query, params) {
  params.page = params.page === undefined ? null : params.page;
  params.pagesize = params.pagesize === undefined ? 100 : params.pagesize;
  
  // need to do a little bit of cleanup for authorize.net and wepay search parameters
  // authorize.net on GitHub goes by AuthorizeNet.  WePay also has a lot of "WeChatPay" apps associated with it, which are not valid
  query = query === 'authorize.net' ? 'authorizenet' : query;
  let topic = query !== 'wepay' ? `topic:${ query }` : `wepay payments topic:${ query }`;

  // if the page is present, then use it, otherwise ignore it
  let q = `query { 
      search(query: "${ topic } is:public fork:false pushed:>${ params.fromdate }", type: REPOSITORY, first: ${ params.pagesize } ${ params.page !== null ? `after:  "${ params.page }"`: '' }){
         pageInfo {
           endCursor 
           startCursor 
           hasNextPage 
        } 
        repositoryCount 
        edges { 
          node{ 
            ... on Repository { 
              name 
              id 
              updatedAt
              pushedAt
              createdAt
              forkCount 
              isFork
              url
              owner {
                login
                id
                url
              }
              stargazers {
                totalCount
              }
              repositoryTopics(first:100){
                totalCount,
                edges{
                  node{
                    topic{
                      name
                    }
                  }
                }
              }
            } 
          } 
        } 
      } 
    }`;
  console.log('Requesting GitHub: ', params);
  var d = await request.post(
    '/graphql', 
    { query: q }, 
    { headers: { 'Authorization': `bearer ${ process.env.GITHUB_ACCESS_TOKEN }` } }
  );
  return d.data;
};


module.exports  = {
  request: request,
  search: search
};
