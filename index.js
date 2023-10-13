require("dotenv").config();

const Koa = require("koa");
const logger = require("koa-logger");
const Router = require("@koa/router");
const cors = require("@koa/cors");
const { koaBody } = require("koa-body");
const uuid = require("uuid");
const {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const postgres = require("postgres");
const jose = require("jose");

const client = new S3Client({ region: "us-east-2" });
const bucket = process.env.S3_BUCKET;

const app = new Koa();
const router = new Router();

app.use(logger());
app.use(koaBody());
app.use(cors({ origin: "*" }));

const sql = postgres(process.env.DATABASE_URL);
sql`SELECT 1`.catch((e) => {
  console.error(e);
  console.error();
  console.error("Couldn't connect to database, stopping...");
  process.exit(1);
}); // fail early if database is unavailable

let user_files_params = ["filename"];

const JWKS = jose.createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URL));
const jwtVerifyOptions = {
  issuer: process.env.OIDC_ISSUER,
  audience: process.env.OIDC_AUDIENCE,
};

const jwt = async (ctx, next) => {
  const authHeader = ctx.headers.authorization;
  if (!authHeader) {
    ctx.status = 401;
    return;
  }

  try {
    const jwt = ctx.headers.authorization.split(" ")[1];
    const { payload, protectedHeader } = await jose.jwtVerify(jwt, JWKS, jwtVerifyOptions);
    ctx.state.subject = payload.sub;
  } catch (e) {
    console.log(e);
    ctx.status = 401;
    return;
  }

  await next();
};

router
  .get("/token", jwt, async (ctx) => {
    ctx.body = { msg: `Hello ${ctx.state.subject}` };
  })

  .get("/user-files", jwt, async (ctx) => {
    const results = await sql`
      SELECT
        id,
        oidc_subject,
        filename,
        s3_key,
        created_at,
        updated_at
      FROM user_files
      WHERE oidc_subject = ${ctx.state.subject}
    `;

    ctx.body = results;
  })

  .get("/user-files/:id/fetch", jwt, async (ctx) => {
    const id = ctx.params.id;

    const results = await sql`
      SELECT s3_key FROM user_files WHERE oidc_subject = ${ctx.state.subject} AND id = ${id}
    `;

    if (results.length === 0) {
      ctx.status = 404;
      return;
    }

    const key = results[0].s3_key;

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    ctx.body = {
      url,
    };
  })

  .post("/user-files", jwt, async (ctx) => {
    const p = strongParams(ctx.request.body, user_files_params);

    const s3_key = uuid.v4();

    // might need to change this to restrict content-length 
    // https://advancedweb.hu/how-to-use-s3-post-signed-urls/
    // const AWS = require("aws-sdk");
    // const s3 = new AWS.S3({signatureVersion: "v4"});
    // 
    // s3.createPresignedPost({
    //   ...
    //   Conditions: [["content-length-range",  0, 1000000], ...], // content length restrictions: 0-1MB
    //   ...
    // })
    const command = new PutObjectCommand({ Bucket: bucket, Key: s3_key });
    const upload_url = await getSignedUrl(client, command, { expiresIn: 3600 });

    const result = await sql`
      INSERT INTO user_files (
        oidc_subject, 
        filename, 
        s3_key, 
        created_at, 
        updated_at
      ) VALUES (
        ${ctx.state.subject},
        ${p.filename},
        ${s3_key},
        NOW(),
        NOW()
      ) RETURNING id, oidc_subject, filename, created_at`;

    ctx.body = { ...result[0], upload_url };
  })

  .get('/status', (ctx) => {
    ctx.body = {status: "ok"};
  });

app.use(router.routes());
app.listen(process.env.PORT ?? 3000);

// helper functions

// only allow certain keys to be set on new and updated objects, a very basic security measure
function strongParams(incomingObject, params) {
  let new_obj = {};

  for (const key of params) {
    if (incomingObject[key] != null) {
      new_obj[key] = incomingObject[key];
    }
  }

  return new_obj;
}
