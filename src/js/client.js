import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import '../css/styles.css';  // CSSファイルをインポート

function ImageUpload() {
  const [image, setImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleReset = () => {
    setImage(null);
    fileInputRef.current.value = '';
  };

  return (
    <div className="container">
      <h1>画像アップロード</h1>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleImageChange} 
      />
      {!image ? (
        <button className="btn btn-primary" onClick={handleButtonClick}>画像を選択</button>
      ) : (
        <div className="image-preview mt-3">
          <h2>プレビュー</h2>
          <img src={image} alt="Uploaded" className="img-thumbnail" />
          <div>
            <button className="btn btn-secondary mt-3" onClick={handleReset}>リセット</button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<ImageUpload />, document.getElementById('app'));
