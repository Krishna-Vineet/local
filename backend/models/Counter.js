import mongoose from 'mongoose';

// Atomic sequence counter (e.g. support ticket numbers HPX-2609-0042).
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function (key) {
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;
