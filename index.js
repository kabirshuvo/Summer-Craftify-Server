const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

//middlewares

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_WEB_TOKEN, (err, decoded) => {
    console.log(err, decoded);
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// * ___________MongoDb...Connection___

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kgipu8l.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classesCollection = client
      .db("summerCraftifyDb")
      .collection("summerClasses");
    const reviewsCollection = client
      .db("summerCraftifyDb")
      .collection("reviews");
    const enroleCollection = client
      .db("summerCraftifyDb")
      .collection("enroled");
    const userCollection = client.db("summerCraftifyDb").collection("users");
    const paymentsCollection = client
      .db("summerCraftifyDb")
      .collection("payments");
      const appionmentsCollection = client
      .db("summerCraftifyDb")
      .collection("appionments");

    // *___JWT___API___*
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_WEB_TOKEN, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // NOTE: I have to use verifyAdmin after verifyJWT
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //*___All___Classes__Apis___*
    app.get("/summerclasses", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.post("/summerclasses", verifyJWT, verifyAdmin, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });
    app.delete(
      "/summerclasses/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await classesCollection.deleteOne(query);
        res.send(result);
      }
    );

    //*___Review___Apis___*
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews);
    });
    // *___Appionments____Apis___*
    app.get("/appionments", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Not Permited User Access" });
      }
      const query = { email: email };
      const result = await appionmentsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/appionments", async (req, res) => {
      const appionment = req.body;
      const result = await appionmentsCollection.insertOne(appionment);
      res.send(result);
    });

    //*______Enrole___APIs___*
    app.get("/enroles", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Not Permited User Access" });
      }

      const query = { email: email };
      const result = await enroleCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/enroles", async (req, res) => {
      const cls = req.body;
      const result = await enroleCollection.insertOne(cls);
      res.send(result);
    });

    app.delete("/enroles/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await enroleCollection.deleteOne(query);
      res.send(result);
    });

    //*___user___collection___Apis___*
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // *___Instructors___Apis___*

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // *___PaYments___Related____Apies___*
    // Payment intent:
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { fees } = req.body;
      const amount = parseInt(fees * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payments api
    app.get("/payments", verifyJWT, async (req, res) => {
      const payments = await paymentsCollection.find().toArray();
      res.send(payments);
    });
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertedResult = await paymentsCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.interesedIn.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await enroleCollection.deleteMany(query);

      res.send({ insertedResult, deleteResult });
    });

    app.get("/admin-status", verifyJWT, verifyAdmin, async (req, res) => {
      const students = await userCollection.estimatedDocumentCount();
      const classes = await classesCollection.estimatedDocumentCount();
      const enrolled = await paymentsCollection.estimatedDocumentCount();
      const payments = await paymentsCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.fees, 0);

      res.send({
        students,
        classes,
        enrolled,
        payments,
        revenue,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("summer craftify server is running");
});

app.listen(port, () => {
  console.log(`Summer Craftify Server is running on port ${port}`);
});
