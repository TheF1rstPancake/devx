var utilities = require('./utilities');

async function answered_questions(db) {
  var collection = db.collection('StackOverflow');

  var results = collection.aggregate([
    {
      $group: { 
        _id: { 
          product: '$product', 
          has_answers: { $gt: ['$answer_count', 0] }
        }, 
        count: { $sum: 1 } 
      }
    },
    {
      $group: {
        _id: '$_id.product',
        has_answers: {
          $sum: {
            $cond: {
              if: { $eq: ['$_id.has_answers', true] },
              then: '$count',
              else: 0
            }
          }
        },
        no_answers: {
          $sum: {
            $cond: {
              if: { $eq: ['$_id.has_answers', false] },
              then: '$count',
              else: 0
            }
          }
        },
        total_questions: { $sum: '$count' }
      }
    },
    {
      $project: {
        has_answers: 1,
        no_answers: 1,
        total_questions: 1,
        ratio: { 
          $divide: [
            '$has_answers', 
            '$total_questions'
          ] 
        }
      }
    }
  ]).toArray();
  return results;
}

async function run(database) {
  var results = await answered_questions(database);
  results = utilities.sortData(results);
  results = utilities.toCsv(results);
  await utilities.writeToFile('answered_questions_ratio.csv', results);
  return results;
}

// main script
if (require.main === module) {
  utilities.run(run);
}