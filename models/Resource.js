import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    instructions: { type: String, default: '', maxlength: 2000 },
    type: { type: String, default: 'Video' },
    url: { type: String, default: '' },
    date: { type: String, required: true },
  },
  { versionKey: false }
);

export default mongoose.model('Resource', resourceSchema);
