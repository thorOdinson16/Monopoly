const mongoose=require('mongoose');
const employeeSchema=new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:80},
  email:{type:String,required:true,trim:true,lowercase:true,unique:true},
  password:{type:String,required:true,select:false}
});
module.exports=mongoose.models.employees || mongoose.model('employees',employeeSchema);
