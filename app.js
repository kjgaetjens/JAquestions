const express = require('express')
const app = express()
const mongo = require('mongodb').MongoClient
const axios = require('axios')
require('dotenv').config()

const PORT = 8080

// MongoDB connection params
const MONGO_USERNAME = process.env.MONGO_USERNAME
const MONGO_PASSWORD = process.env.MONGO_PASSWORD
const MONGO_DATABASE = process.env.MONGO_DATABASE

// Connect to MongoDB
mongo.connect(`mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@bcycle-stats-mezgf.gcp.mongodb.net/${MONGO_DATABASE}?retryWrites=true&w=majority`, {useNewUrlParser: true, useUnifiedTopology: true}, (error,client) => {
    if(!error) {
        console.log('Successfully connected to MongoDB database')
        const db = client.db('questions')

        app.post('/refresh-data', async (req, res)=> {
            let districtBoundaries = await axios('https://opendata.arcgis.com/datasets/e2826101978143b9beb39d52ead86019_0.geojson')

            structuredDistricts = []

            polygons = ["C","G","D","J"]
            multipolygons = ["I","F","K","E","H","B","A"]

            districtBoundaries.data.features.forEach(feature => {
                if (polygons.includes(feature.properties.DISTRICT)) {
                    structuredDistrict = {
                        district: feature.properties.DISTRICT,
                        geometry: {
                            type: "Polygon",
                            coordinates: feature.geometry.coordinates
                        }
                    }
                    structuredDistricts.push(structuredDistrict)
                } else if (multipolygons.includes(feature.properties.DISTRICT)) {
                    feature.geometry.coordinates.forEach(subFeature => {
                        structuredDistrict = {
                            district: feature.properties.DISTRICT,
                            geometry: {
                                type: "Polygon",
                                coordinates: subFeature
                            }
                        }
                        structuredDistricts.push(structuredDistrict)
                    })
                }
            })

            await db.collection('districts').deleteMany({})
            await db.collection('districts').insertMany(structuredDistricts)
    
            // let busStops = await axios('https://opendata.arcgis.com/datasets/1dc7a23374ac44cdae8553044bfeaf22_9.geojson')
            // await db.collection('busstops').deleteMany({})
            // await db.collection('busstops').insertMany(busStops.data.features)
    
            // let busRoutes = await axios('https://opendata.arcgis.com/datasets/c2274084571d4f968cac09a608b868c4_4.geojson')
            // await db.collection('busroutes').deleteMany({})
            // await db.collection('busroutes').insertMany(busRoutes.data.features)
            res.send('success')
        })

        app.get('/busStopsD', async (req, res) => {
            db.collection('busstops').createIndex( { geometry: "2dsphere" } )

            let districtD = await db.collection('districts').findOne({
                district:"D"
            })

            //intersects and within return same count
            let busStops = await db.collection('busstops').find({
                geometry: {
                    $geoIntersects: {
                       $geometry: districtD.geometry
                    }
                  }
            })

            let busStopsArray = await busStops.toArray()

            res.json({numStops: busStopsArray.length})
        })

        app.get('/busRoutes', async (req, res) => {
            db.collection('busroutes').createIndex( { geometry: "2dsphere" } )

            let routeCounts = []

            let districts = await db.collection('districts').find({}).toArray()
            for (let i=0; i<districts.length; i++) {
                let busRoutes = await db.collection('busroutes').find({
                    geometry: {
                        $geoIntersects: {
                           $geometry: districts[i].geometry
                        }
                      }
                }).toArray()
                routeCounts.push({district:districts[i].district, count:busRoutes.length})
                console.log({district:districts[i].district, count:busRoutes.length})
            }

            // console.log(routeCounts)
        })
        

    } else {
        console.log(error)
    }
})


app.listen(PORT, () => {
    console.log("Server is running...")
})