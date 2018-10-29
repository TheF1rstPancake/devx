const axios = require('axios');
const database = require('./database');
const Promise = require('bluebird');
const stackoverflow = require('./stackoverflow');
const github = require('./github');
const env = require('node-env-file');
var parseArgs = require('minimist');


// Create rate limiters for API calls
// stack's limit is 30 requests per second
// we will limit to 29 just to be safe
// github's is something like 5000 an hour, so really shouldn't be more than 2 a second
// then again, this script should only run for a few seconds
// so we are making it 10 per second just to be safe
const RateLimiter = require('limiter').RateLimiter;
const stack_limiter = new RateLimiter(29, 'second');
const github_limiter = new RateLimiter(10, 'second');

// read env file
env('./.env');

async function bulkWriteDocuments(collection, bulkWrite, options) {
  options = options === undefined || options === null ? {} : options;

  // write the data to Mongo and set up the next search
  console.log(`Writing ${ bulkWrite.length } documents`);
  try {
    await collection.bulkWrite(bulkWrite, { ordered: false });
    console.log(`Wrote ${ bulkWrite.length } documents`);

  } catch (err) {
    console.log('Issue bulk writing documents: ', err); 
  }
 
  // we can optionally choose to return failed writes
  // by default, we will return an empty list
  // if this is true, then we will return all of the failed documents so that the next write can try
  if (options.return_failed_writes !== true) {
    bulkWrite = [];
  }

  return bulkWrite;
}

async function scrape_product_stackoverflow(mongo, product_name, options) {
  options = options === undefined ? {} : options;
 
   // get the StackOverflow collection and ensure we've given it the right indeces
  var collection = await mongo.collection('StackOverflow');

  // initialize variables
  var has_more = true;
  var page = 1;
  var num_documents = 0;

  // define the params to send to the stackexchange API
  var default_params = { 
    title: product_name, 
    site: 'stackoverflow', 
    pagesize: 25, 
    sort: 'relevance',
  };
  var params = Object.assign({}, default_params, options);
  params.fromdate = params.fromdate !== undefined ? new Date(params.fromdate)/1000 : undefined;

  let bulkWrite = [];      
  while (has_more === true) {
    // update the page before each search
    params.page = page;

    // put a limiter just in case we ever approach the 30 calls per second
    var can = stack_limiter.tryRemoveTokens(1);
    while (!can) {
      can = stack_limiter.tryRemoveTokens(1);
    } 
    var data = await stackoverflow.search(product_name, params);

    // define the bulk write operations
    // and do some basic clean up of the data
    for (var i in data.items) {
      let document = data.items[i];
      let id = document.question_id;
      document.id = id;
      document.search_term = product_name;

      // write the document.  If it already exists, perform an update.  If it's new, then insert (upsert=true)
      bulkWrite.push(
        { updateOne: {
          filter: { id: id, search_term: product_name }, 
          update: data.items[i], 
          w: 1,
          upsert: true
        } }
      );
    }

    if (bulkWrite.length > 1000) {
      num_documents += bulkWrite.length;
      bulkWrite = await bulkWriteDocuments(collection, bulkWrite);
    }
    has_more = data.has_more;
    page++;
  }

  // clear out the last set of documents to write
  if (bulkWrite.length > 0) {
    num_documents += bulkWrite.length;
    bulkWrite = await bulkWriteDocuments(collection, bulkWrite);
  }

  return num_documents;
}

async function scrape_product_github(mongo, product_name, options) {
  options = options === undefined ? {} : options;
 
   // get the StackOverflow collection and ensure we've given it the right indeces
  var collection = await mongo.collection('GitHub');

  // initialize variables
  var has_more = true;
  var page = null;
  var num_documents = 0;

  // define the params to send to the stackexchange API
  var default_params = { 
    q: product_name, 
    pagesize: 100,
  };
  var params = Object.assign({}, default_params, options);

  let bulkWrite = [];      
  while (has_more === true) {
    // update the page before each search
    params.page = page;

    // put a limiter just in case we ever approach the 30 calls per second
    var can = github_limiter.tryRemoveTokens(1);
    while (!can) {
      can = github_limiter.tryRemoveTokens(1);
    } 
    var data = await github.search(product_name, params);
    // define the bulk write operations
    // and do some basic clean up of the data
    for (var i in data.data.search.edges) {
      let document = data.data.search.edges[i].node;
      document.search_term = product_name;
      document.createdAt = new Date(document.createdAt);
      document.updatedAt = new Date(document.updatedAt);
      document.pushedAt = new Date(document.pushedAt);
      document.owner.login = document.owner.login.toLowerCase();

      // write the document.  If it already exists, perform an update.  If it's new, then insert (upsert=true)
      bulkWrite.push(
        { 
          updateOne: {
            filter: { id: document.id, search_term: product_name }, 
            update: document, 
            w: 1,
            upsert: true
          } 
        }
      );
    }

    if (bulkWrite.length > 1000) {
      num_documents += bulkWrite.length;
      bulkWrite = await bulkWriteDocuments(collection, bulkWrite);
    }
    has_more = data.data.search.pageInfo.hasNextPage;

    // update page
    page = data.data.search.pageInfo.endCursor;
  }

  // clear out the last set of documents to write
  if (bulkWrite.length > 0) {
    num_documents += bulkWrite.length;
    bulkWrite = await bulkWriteDocuments(collection, bulkWrite);
  }

  return num_documents;
}

/*
 * Run the script
 */
if (require.main === module) {
  // get command line args
  var argv = parseArgs(process.argv);

  // list of products to scrape
  var products_to_scrape = ['wepay', 'stripe', 'paypal', 'braintree', 'adyen', 'amazon pay', 'authorize.net', 'airtable'];
  
  // sites to scrape them from
  var sites_to_scrape = argv.sites_to_scrape === undefined ? ['stackoverflow', 'github'] : argv.sites_to_scrape;
  if (!(sites_to_scrape instanceof Array)) {
    sites_to_scrape = [sites_to_scrape];
  }

  // get the database and scrape
  database.get().then(async(mongo) => {
    var start = '2017-01-01';
    var options = {
      fromdate: start,
      pagesize: 100
    };

    // build the list of scrape vectors.  This just combines the products_to_scrape and sites_to_scrape
    var scrape_list = [];
    for (var s in sites_to_scrape) {
      for (var p in products_to_scrape) {
        scrape_list.push({
          site: sites_to_scrape[s],
          product: products_to_scrape[p]
        });
      }
    }

    // map out the scrape_list
    // depending on what site we are scraping, call the appropriate function
    var p = await Promise.map(scrape_list, async (product) => {
      var num_documents = 0;

      if (product.site === 'stackoverflow') {
        num_documents = await scrape_product_stackoverflow(mongo, product.product, options);
      } else if (product.site === 'github') {
        num_documents = await scrape_product_github(mongo, product.product, options);
      }
      product.num_documents = num_documents;
      return product;
    }, { concurrency: 8 });
    return p;
  }).then((r) => {
    // print out each scrape vector and the number of documents written
    console.log('DONE: ', r);
    process.exit(0);
  }).catch((err) => {
    console.log('ERROR FETCHING: ', err); 
    process.exit(1);
  });
}