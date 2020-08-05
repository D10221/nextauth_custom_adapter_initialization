import NextAuth from "next-auth";
import Adapters from "next-auth/adapters";
import Providers from "next-auth/providers";
import url from "url";
import fs from "fs";
import path from "path";

let intialized = false;
/** */
async function initializeUsers(adapter) {
  if (intialized) return;
  intialized = true;
  try {
    console.log("initializing users");
    let user = await adapter.getUser(1);
    if (!user)
      await adapter.createUser({
        name: "admin",
        email: "admin@localhost",
      });
  } catch (error) {
    console.error("initializeUsers", error);
  }
}

const dbUrl = url.parse(process.env.NEXTAUTH_DATABASE_URL);

const dbLocation = path.join(process.cwd(), dbUrl.host, dbUrl.path);
console.log("dblocation: ", dbLocation);

const sync = !fs.existsSync(dbLocation) ? true : false;
console.log("SYNC: ", sync);

const databaseUrl = sync
  ? process.env.NEXTAUTH_DATABASE_URL + "?synchronize=true"
  : process.env.NEXTAUTH_DATABASE_URL;

console.log("databaseUrl: ", databaseUrl);

const standardAdapter = process.env.NEXTAUTH_DATABASE_ADAPTER === "standard";
console.log("standardAdapter: ", standardAdapter);

/** */
const options_initializable = {
  adapter_mode: "initializable",
  adapter: Adapters.TypeORM.Adapter(databaseUrl),
  providers: [
    Providers.Credentials({
      name: "Credentials",
      credentials: {
        username: {
          label: "Email",
          type: "text",
          placeholder: "admin:admin@localhost",
        },
        password: { label: "Password", type: "password" },
      },
      authorize: async function authorize({ username, password }) {
        try {
          const _adapter = await options_initializable.adapter.getAdapter();
          // initialize users (once)
          await initializeUsers(_adapter);
          // ... authorize
          const user = await _adapter.getUserByEmail(username);
          return await user;
        } catch (error) {
          console.error("authorize", error);
          return Promise.resolve(null);
        }
      },
    }),
  ],
  session: { jwt: true },
  jwt: {},
};
/** */
const options_standard = {
  adapter_mode: "standard",
  // accepts initialization
  adapter: (database, options) => Adapters.TypeORM.Adapter(database, options),
  // database decoupled from 'Adapter'
  database: databaseUrl,
  providers: [
    Providers.Credentials({
      name: "Credentials",
      credentials: {
        username: {
          label: "Email",
          type: "text",
          placeholder: "admin:admin@localhost",
        },
        password: { label: "Password", type: "password" },
      },
      authorize: async function authorize({ username, password }) {
        try {
          // self reference:
          const _adapter = await options_standard
            .adapter(options.database)
            .getAdapter();
          // initialize users (once)
          await initializeUsers(_adapter);
          const user = await _adapter.getUserByEmail(username);
          console.log("user: ", JSON.stringify(user, null, 2));
          return await user;
        } catch (error) {
          console.error("authorize", error);
          return Promise.resolve(null);
        }
      },
    }),
  ],
  session: { jwt: true },
  jwt: {},
};

const options = standardAdapter ? options_standard : options_initializable;
console.log("adapter_mode: ", options.adapter_mode);
/** */
export default (req, res) => NextAuth(req, res, options);
