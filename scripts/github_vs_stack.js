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

async function run(database) {
  var gh = await github_vs_stack(database);
  gh = utilities.sortData(gh);
  var output = utilities.toCsv(gh);
  await utilities.writeToFile('github_vs_stack.csv', output);
  return output;
}

if (require.main === module) {
  utilities.run(run);
}