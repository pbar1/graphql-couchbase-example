const Express = require("express");
const Couchbase = require("couchbase");
const ExpressGraphQL = require("express-graphql");
const BuildSchema = require("graphql").buildSchema;
const UUID = require("uuid");

var cluster = new Couchbase.Cluster("couchbase://localhost");
cluster.authenticate("example", "123456");
var bucket = cluster.openBucket("example");

var schema = BuildSchema(`
    type Query {
        account(id: String!): Account,
        accounts: [Account],
        blog(id: String!): Blog,
        blogs(account: String!): [Blog]
    }
    type Account {
        id: String,
        firstname: String,
        lastname: String,
    }
    type Blog {
        id: String,
        account: String!,
        title: String,
        content: String
    }
    type Mutation {
        createAccount(firstname: String!, lastname: String!): Account
        createBlog(account: String!, title: String!, content: String!): Blog
    }
`);

var resolvers = {
  createAccount: (data) => {
    var id = UUID.v4();
    data.type = "account";
    return new Promise((resolve, reject) => {
      bucket.insert(id, data, (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({ "id": id });
      });
    });
  },
  createBlog: (data) => {
    var id = UUID.v4();
    data.type = "blog";
    return new Promise((resolve, reject) => {
      bucket.insert(id, data, (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({ "id": id });
      });
    });
  },
  blog: (data) => {
    var id = data.id;
    return new Promise((resolve, reject) => {
      bucket.get(id, (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result.value);
      });
    });
  },
  blogs: (data) => {
    var statement = "SELECT META(blog).id, blog.* FROM `" + bucket._name + "` AS blog WHERE blog.type = 'blog' AND blog.account = $account";
    var query = Couchbase.N1qlQuery.fromString(statement);
    return new Promise((resolve, reject) => {
      bucket.query(query, { "account": data.account }, (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      });
    });
  }
};

var app = Express();

app.use("/graphql", ExpressGraphQL({
  schema: schema,
  rootValue: resolvers,
  graphiql: true
}));

app.listen(3000, () => {
  console.log("Listening at :3000");
});

