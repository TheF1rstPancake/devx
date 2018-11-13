var utilities = require('./utilities');

async function company_owned(db) {
  var collection = db.collection('GitHub');

  var results = await collection.aggregate([
    {
      $project: {
        product: {
          $cond: {
            if: { $eq: ['$product', 'authorize.net'] },
            then: 'authorizenet',
            else: {
              $cond: {
                if: { $eq: ['$product', 'smartsheet'] },
                then: 'smartsheet-platform',
                else: '$product'
              }
            }
          }
        },
        stargazers: 1,
        owner: 1
      }
    },
    { 
      $project: 
      { 
        _id: '$product', 
        owner: { 
          '$eq': ['$product', '$owner.login'] 
        },
        stargazers: 1 
      } 
    }, 
    { 
      $group: { 
        _id: { 
          product: '$_id', owner: '$owner' }, 
        count: { $sum: 1 },
        stars: { $sum: '$stargazers.totalCount' } 
      } 
    },
    {
      $group: {
        _id: '$_id.product',
        owned: { 
          $sum:
          { 
            $cond: {
              if: { $eq: ['$_id.owner', true] },
              then: '$count',
              else: 0
            } 
          }
        },
        owned_stars: {
          $sum:
          { 
            $cond: {
              if: { $eq: ['$_id.owner', true] },
              then: '$stars',
              else: 0
            } 
          }
        },
        not_owned: {
          $sum:
          { 
            $cond: {
              if: { $eq: ['$_id.owner', false] },
              then: '$count',
              else: 0
            } 
          },
        },
        not_owned_stars: {
          $sum:
          { 
            $cond: {
              if: { $eq: ['$_id.owner', false] },
              then: '$stars',
              else: 0
            } 
          }
        } 
      }
    },
    {
      $project: {
        owned: 1,
        not_owned: 1,
        owned_stars_per_repo: { 
          $cond: {
            if: { $eq: ['$owned', 0] },
            then: 0,
            else: { $divide: ['$owned_stars', '$owned'] },
          } 
        },
        not_owned_stars_per_repo: { 
          $cond: {
            if: { $eq: ['$not_owned', 0] },
            then: 0,
            else: { $divide: ['$not_owned_stars', '$not_owned'] },
          }
        },
        owned_stars: 1,
        not_owned_stars: 1
      }
    }
  ]).toArray();

  return results;
}

async function run(database) {
  var results = await company_owned(database);
  results = utilities.sortData(results);
  results = utilities.toCsv(results);
  await utilities.writeToFile('company_repos.csv', results);
  return results;
}

// main script
if (require.main === module) {
  utilities.run(run);
}