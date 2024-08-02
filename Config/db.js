const mongoose= require("mongoose")
const dotenv=require("dotenv").config();



const db=async()=>{
    try{
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("DB Connected");
    }
catch(error){
console.error("Connection Failed")
process.exit(1);
}}
module.exports=db