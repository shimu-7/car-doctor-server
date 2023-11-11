const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors({
  origin: [
     'http://localhost:5173',
    // 'https://user-email-password-auth-58e98.web.app',
    // 'https://user-email-password-auth-58e98.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fd2onld.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//user defined middleware
const logger = async(req,res, next) =>{
  console.log('called', req.hostname, req.originalUrl);
  next();
}

const verifyToken = async(req,res, next)=>{
  const token = req.cookies?.token;
  //console.log('token in middleware', token)
  if(!token){
    return res.status(401).send({message: 'Not Authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      console.log(err)
      return res.status(401).send({message: 'unauthorized'})
    }
    console.log('value in the token', decoded)
    req.user = decoded;
    next()
  })

}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');

    //Auth related Api
    app.post('/jwt', logger, async(req,res)=>{
      const user = req.body;
      console.log('user for token',user);

      //token generating
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      //res.send({token});
      res
      //set token in cookie
      .cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
        
      })
      .send({success: true});
    })

    app.post('/logout', async(req,res)=>{
      const user = req.body;
      console.log('logging Out', user);
      res.clearCookie('token',{maxAge: 0}).send({success: true})
    })


    //Services related API
    app.get('/services',logger, async (req, res) => {
      const filter = req.query;
      console.log(filter);
      const query = {
       // price: {$lt: 150, $gt: 10}
        title: {$regex: filter.search, $options: 'i'}
      };
      const options = {
        sort: {
           price: filter.sort==='asc'?1:-1
          
        }
      }
      const cursor = serviceCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };

      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    })

    //booking
    app.get('/bookings',logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      //console.log('token',req.cookies.token)
      console.log('from valid token ', req.user)
      if(req.query.email!==req.user.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result)
    })

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const updateDoc = {
        $set: {
          status: updatedBooking.status
        },
      };
      const result = await bookingCollection.updateOne(filter,updateDoc);
      res.send(result)
    })

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query);
      res.send(result)
      

    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


// to check whether server is running or not
app.get('/', (req, res) => {
  res.send('car doctor is running');
})
app.listen(port, () => {
  console.log(`car doctor running on port ${port}`);
})
