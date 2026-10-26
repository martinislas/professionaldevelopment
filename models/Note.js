import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    resourceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    created: { type: String, required: true },
  },
  { versionKey: false }
);

export default mongoose.model('Note', noteSchema);
