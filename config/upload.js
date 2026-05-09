const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype.startsWith("image")) {
      cb(null, "uploads/perfiles");
    } else if (file.mimetype.startsWith("video")) {
      cb(null, "uploads/publicaciones");
    } else {
      cb(null, "uploads/documentos");
    }
  },
  filename: function (req, file, cb) {
    const nombre = Date.now() + path.extname(file.originalname);
    cb(null, nombre);
  },
});

const upload = multer({ storage });

module.exports = upload;