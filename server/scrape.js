const axios = require('axios');
const database = require('./database');
const Promise = require('bluebird');
const stackoverflow = require('./stackoverflow');
const github = require('./github');
const env = require('node-env-file');
const products = require('../products');

var parseArgs = require('minimist');


// create API limiters for the API calls
const RateLimiter = require('limiter').RateLimiter;
const stack_limiter = new RateLimiter(3, 'second');
const github_limiter = new RateLimiter(3, 'second');

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
    query: product_name, 
    site: 'stackoverflow',
    pagesize: 100,  
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
      document.product = product_name;

      // write the document.  If it already exists, perform an update.  If it's new, then insert (upsert=true)
      bulkWrite.push(
        { updateOne: {
          filter: { id: id, product: product_name }, 
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

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
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
    query: product_name
  };
  var params = Object.assign({}, default_params, options);

  let bulkWrite = [];      
  while (has_more === true) {
    // update the page before each search
    params.page = page;

    // put a limiter just in case we ever approach the 30 calls per second
    var can = github_limiter.tryRemoveTokens(1);
    while (!can) {
      console.log('PAUSED: ', can);
      can = github_limiter.tryRemoveTokens(1);
    } 
    
    // fetch data and make sure we actually got something back
    try {
      var data = await github.search(product_name, params);
    } catch (err) {
      // if GitHub tells us we were pinging them too fast, go to sleep and try again in 2 minutes
      if (err.response.status === 403) {
        console.log('Sleeping on: ', product_name);
        await sleep(2*60*1000);
        continue;
      }
    }

    // define the bulk write operations
    // and do some basic clean up of the data
    for (var i in data.data.search.edges) {
      let document = data.data.search.edges[i].node;
      document.product = product_name;
      document.createdAt = new Date(document.createdAt);
      document.updatedAt = new Date(document.updatedAt);
      document.pushedAt = new Date(document.pushedAt);
      document.owner.login = document.owner.login.toLowerCase();

      // write the document.  If it already exists, perform an update.  If it's new, then insert (upsert=true)
      bulkWrite.push(
        { 
          updateOne: {
            filter: { 
              id: document.id, product: product_name 
            }, 
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
  var products_to_scrape = argv.products_to_scrape === undefined ? Object.keys(products.products) : argv.products_to_scrape;
  if (!(products_to_scrape instanceof Array)) {
    products_to_scrape = [products_to_scrape];
  }
  
  // sites to scrape them from
  var sites_to_scrape = argv.sites_to_scrape === undefined ? Object.keys(products.sites) : argv.sites_to_scrape;
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
      let site_name = sites_to_scrape[s];
      for (var p in products_to_scrape) {
        let product_name = products_to_scrape[p];
        let opts = Object.assign({}, options, products.products[product_name][site_name]);

        let payload = {
          site: site_name,
          product: product_name,
          options: opts
        };
        // add the scrape options
        scrape_list.push(payload);
      }
    }

    // map out the scrape_list
    // depending on what site we are scraping, call the appropriate function
    var p = await Promise.map(scrape_list, async (product) => {
      var num_documents = 0;

      if (product.site === 'stackoverflow') {
        num_documents = await scrape_product_stackoverflow(mongo, product.product, product.options);
      } else if (product.site === 'github') {
        num_documents = await scrape_product_github(mongo, product.product, product.options);
      } else {
        throw 'ERROR: SITE DOES NOT EXIST';
      }
      product.num_documents = num_documents;
      return product;
    }, { concurrency: 4 });
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