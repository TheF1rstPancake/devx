const database = require('../server/database');
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

// main script
if (require.main === module) {
  database.get().then(async (db) => {
    var results = await answered_questions(db);
    results = utilities.toCsv(results);
    return results;
  }).then((results) => {
    console.log('DONE:\n', results, '\n-------------');
    process.exit(0);
  }).catch((err) => {
    console.log('FAILED: ', err);
    process.exit(1);
  });
}