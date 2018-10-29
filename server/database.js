const mongodb = require('mongodb');

var url = 'mongodb://localhost:27017/mydb';
var MongoClient = mongodb.MongoClient;

var database = null;

var initializers = {
  StackOverflow: async (db) => {
    try {  
      var collection = await db.createCollection('StackOverflow');
    } catch (err) {
      throw err;
    }
    // create indeces
    await collection.createIndex({ id: 1 });
    await collection.createIndex({ search_term: 1 });
    await collection.createIndex({ id: 1, search_term: 1 }, { unique: true });
  },
  Products: async(db) => {
    try {  
      var collection =  await db.createCollection('Product');
    } catch (err) {
      throw err;
    }
    collection.createIndex({ name: 1 }, { unique: true });
  },
  GitHub: async(db) => {
    try {  
      var collection = await db.createCollection('GitHub');
    } catch (err) {
      throw err;
    }
    // create indeces
    await collection.createIndex({ id: 1 });
    await collection.createIndex({ search_term: 1 });
    await collection.createIndex({ id: 1, search_term: 1 }, { unique: true });
  }
};

const initialize = async(db) => {
  var promise_list = [];
  for (var i in initializers) {
    var p = initializers[i](db);
    promise_list.push(p);
  }
  await Promise.all(promise_list);
  return db;
};

const connect = async () => {
  return new Promise((resolve, reject) => {
    MongoClient.connect(url, function(err, client) {
      if (err) {
        reject(err);
      }
      database = client.db('mydb');
      initialize(database)
        .then(() => {resolve(database);})
        .catch(reject);
    });
  });
};

const create_product = async function(mongo, product_name) {
  var collection = await mongo.collection('Product');
  try {
    var response = await collection.insert({ name: product_name });
  } catch (err) {
    if (err.code !== 11000) {
      throw err;
    } else {
      var response = (await collection.find({ name: product_name }).limit(1).toArray())[0];
    }
  }
  return response;

};


module.exports = {
  database: (async() => {await connect();}),
  connect: connect,
  get: async () => {
    if (!database) {
      database = await connect();
    }
    return database;
  },
  create_product: create_product
};