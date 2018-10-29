# GitHub and StackOverflow Metrics
Measure a product's performance on GitHub and StackOverflow.

## Express React Starter
Bootstrapped from a express-react starter kit.

Read the article: [Introducing Express React Starter](https://medium.com/burke-knows-words/introducing-express-react-starter-b6d299206a3a)

## Configuration
To properly query GitHub's API, you need to provide some method of authentication.  Our GitHub module currently does this via a personal access token.  It loads this from a ".env" file at the top level directory.  The environment variable should be called `GITHUB_ACCESS_TOKEN`.

For more info on creating a personal access token: https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/

