import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../css/styles.css';  // CSSファイルをインポート
import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';  // Mediapipeのインポート

function ImageUpload() {
  const [image, setImage] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (image && canvasRef.current) {
      const imgElement = new Image();
      imgElement.src = image;
      imgElement.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        //const scaleSize = 1000 / Math.max(imgElement.width, imgElement.height);
        const scaleSize = 1
        canvas.width = imgElement.width * scaleSize;
        canvas.height = imgElement.height * scaleSize;
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          const { poseLandmarks, faceLandmarks } = await detectLandmarks(blob);

          drawLandmarks(faceLandmarks, poseLandmarks)

        }, 'image/jpeg');
      };
    }
  }, [image]);

  const handleImageChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const detectLandmarks = async (imageBlob) => {
    const imageBitmap = await createImageBitmap(imageBlob);

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    const poseLandmarks = await detectPoseLandmarks(vision, imageBitmap);
    let faceLandmarks = null
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;

    for (const landmarks of poseLandmarks.landmarks) {
      const centerX = landmarks[0].x * imageBitmap.width;
      const centerY = landmarks[0].y * imageBitmap.height;

      const top = Math.min(landmarks[7].y, landmarks[8].y) * imageBitmap.height
      const bottom = Math.max(landmarks[10].y, landmarks[9].y) * imageBitmap.height
      const left = Math.min(landmarks[8].x, landmarks[10].x) * imageBitmap.width;
      const right = Math.max(landmarks[7].x, landmarks[9].x) * imageBitmap.width;

      const n = 10
      const m = 5
      const cropX = Math.max(centerX + (left - centerX) * m, 0)
      const cropWidth = Math.min(centerX + (right - centerX) * m, imageBitmap.width) - cropX
      const cropY = Math.max(centerY + (top - centerY) * n, 0)
      const cropHeight = Math.min(centerY + (bottom - centerY) * n, imageBitmap.height) - cropY

      const croppedImageBitmap = await cropImageBitmap(imageBitmap, cropX, cropY, cropWidth, cropHeight)

      const cropprdFaceLandmarks = await detectFaceLandmarks(vision, croppedImageBitmap)

      cropprdFaceLandmarks.faceLandmarks.forEach(faceLandmarks => {
        faceLandmarks.forEach(landmark => {
          landmark.x = (cropX + landmark.x * cropWidth) / imageBitmap.width
          landmark.y = (cropY + landmark.y * cropHeight) / imageBitmap.height
        });
      });

      if (!faceLandmarks) {
        faceLandmarks = cropprdFaceLandmarks
      } else if (cropprdFaceLandmarks.faceLandmarks) {
        faceLandmarks.faceLandmarks.push(cropprdFaceLandmarks.faceLandmarks.pop())
      }
    };

    return { poseLandmarks, faceLandmarks }
  };

  async function cropImageBitmap(originalImageBitmap, cropX, cropY, cropWidth, cropHeight) {
    // キャンバスを作成し、コンテキストを取得
    const canvas = document.createElement("canvas");
    const context = canvas.getContext('2d');

    // キャンバスのサイズを設定
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // 元のImageBitmapの一部をキャンバスに描画
    context.drawImage(originalImageBitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // 新しいImageBitmapを作成
    const croppedImageBitmap = await createImageBitmap(canvas);

    return croppedImageBitmap;
  }

  const detectFaceLandmarks = async (vision, imageBitmap) => {
    const faceLandmarker = await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "IMAGE"
      });
    return faceLandmarker.detect(imageBitmap);
  };

  const detectPoseLandmarks = async (vision, imageBitmap) => {
    const poseLandmarker = await PoseLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath: "../../shared/models/pose_landmarker_lite.task"
        },
        runningMode: "IMAGE"
      }
    );
    return await poseLandmarker.detect(imageBitmap);
  };


  const drawLandmarks = (faceLandmarkerResult, poseLandmarkerResult) => {
    console.log(faceLandmarkerResult)
    console.log(poseLandmarkerResult)

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;


    faceLandmarkerResult.faceLandmarks.forEach(faceLandmarks => {
      const centerX = faceLandmarks[4].x
      const centerY = faceLandmarks[4].y

      const face_top = faceLandmarks[10].y
      const face_bottom = faceLandmarks[152].y
      const face_left = faceLandmarks[127].x
      const face_right = faceLandmarks[356].x
      const eye_height = (faceLandmarks[468].y + faceLandmarks[473].y) / 2

      const head_top = centerY + (eye_height - centerY) * 4
      const head_bottom = face_bottom
      const head_left = centerX + (face_left - centerX) * 1.1
      const head_right = centerX + (face_right - centerX) * 1.1


      ctx.beginPath();
      ctx.arc(head_left * canvas.width, head_top * canvas.height, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(head_right * canvas.width, head_bottom * canvas.height, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";
      ctx.fill();
      
    });
    // poseLandmarkerResult.landmarks.forEach(body => {
    //   body.forEach(landmark => {
    //     ctx.beginPath();
    //     ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, 2 * Math.PI);
    //     ctx.fillStyle = "red";
    //     ctx.fill();
    //   });
    // });
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleReset = () => {
    setImage(null);
    fileInputRef.current.value = '';
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
          <canvas ref={canvasRef} className="img-thumbnail"></canvas>
          <div>
            <button className="btn btn-secondary mt-3" onClick={handleReset}>リセット</button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<ImageUpload />, document.getElementById('app'));
