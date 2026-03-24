const multer = require('multer');

var Storage = multer.diskStorage({
    destination:"./public/uploads/",
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  })
  
  const upload = multer({ storage: Storage });

  module.exports = upload;