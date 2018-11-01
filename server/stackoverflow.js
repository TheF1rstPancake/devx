const axios = require('axios');

const config = { base_uri: 'https://api.stackexchange.com', api_version: '2.2' };

const request = axios.create({
  baseURL: `${ config.base_uri }/${ config.api_version }`,
  timeout: 5000,
});

async function getAnswers(question_ids) {
  var question_list = question_ids.join(';');
  var d = await request.get(
    `questions/${ question_list }/answers`,
    { params: {
      site: 'stackoverflow',
      order: 'desc',
      sort: 'votes',
      page_size: 100,
      key: process.env.STACKOVERFLOW_ACCESS_TOKEN
    } }
  );

  return d.data;
};

const search = async function(query, params) {
  params.page = params.page === undefined ? 1 : params.page;
  params.pagesize = params.pagesize === undefined ? 100 : params.pagesize;
  params.q = params.query;
  params.key = process.env.STACKOVERFLOW_ACCESS_TOKEN;
  // get questions
  console.log('Requesting StackOverflow', params);
  var questions = await request.get(
    '/search/advanced', 
    { 
      params: params, 
    }
  );

  // get their associated answers
  var question_ids = questions.data.items.map((i) => {
    return i.question_id;
  });
  var answers = await getAnswers(question_ids);

  // nest the answers with the appropriate questions
  // there's likely a faster way to do this merge, but this will work for now
  for (var i in answers.items) {
    var question_id = answers.items[i].question_id;

    for (var j in questions.data.items) {
      if (question_id === questions.data.items[j].question_id) {
        if (questions.data.items[j].answers === undefined) {
          questions.data.items[j].answers = [];
        }
        questions.data.items[j].answers.push(answers.items[i]);
        break;
      }
    }
  }


  return questions.data;
};


module.exports  = {
  request: request,
  search: search
};

