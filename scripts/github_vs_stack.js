const database = require('../server/database');

async function github_vs_stack(mongo) {
  var collection = await mongo.collection('GitHub');

  var results = await collection.aggregate([
    {
      $group: {
        _id: '$search_term',
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
        foreignField: 'search_term',
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

function toCsv(data) {
  var out = [];
  var header = Object.keys(data[0]).join(', ');
  out.push(header);


  for (var i in data) {
    var row = Object.values(data[i]).join(', ');
    out.push(row);
  }
  return out.join('\n');
}

if (require.main === module) {
  database.get().then(async(mongo) => {
    var gh = await github_vs_stack(mongo);
    
    var output = toCsv(gh);
    return output;
    
  }).then((results) => {
    console.log('DONE: \n', results, '\n----------------');
    process.exit(0);
  }).catch((err) => {
    console.log('FAILED: ', err);
    process.exit(1);
  });
}