const database = require('../server/database');
var utilities = require('./utilities');

async function github_vs_stack(mongo) {
  var collection = await mongo.collection('GitHub');

  var results = await collection.aggregate([
    {
      $group: {
        _id: '$product',
        repos: { $sum: 1 },
        stars: { $sum: '$stargazers.totalCount' }
      }
    },
    {
      $project: {
        stars_per_repo: { $divide: ['$stars', '$repos'] },
        repos: 1,
        stars: 1
      }
    },
    {
      $lookup: {
        from: 'StackOverflow',
        localField: '_id',
        foreignField: 'product',
        as: 'stack'
      }
    },
    {
      $project: {
        questions: { $size: '$stack' },
        repos: 1,
        stars: 1,
        stars_per_repo: 1
      }
    }
  ]).toArray();

  return results;
}


if (require.main === module) {
  database.get().then(async(mongo) => {
    var gh = await github_vs_stack(mongo);
    
    var output = utilities.toCsv(gh);
    return output;
    
  }).then((results) => {
    console.log('DONE: \n', results, '\n----------------');
    process.exit(0);
  }).catch((err) => {
    console.log('FAILED: ', err);
    process.exit(1);
  });
}