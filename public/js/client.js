import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../css/styles.css';  // CSSファイルをインポート
import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';  // Mediapipeのインポート

function ImageUpload() {
  const [image, setImage] = useState(null);
  const [headRatioText, setHeadRatioText] = useState('');
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (image && canvasRef.current) {
      const imgElement = new Image();
      imgElement.src = image;
      imgElement.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const scaleSize = 600 / Math.max(imgElement.width, imgElement.height);
        canvas.width = imgElement.width * scaleSize;
        canvas.height = imgElement.height * scaleSize;
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          const imageBitmap = await createImageBitmap(blob);
          const landmarkPaires = await detectLandmarkPaires(imageBitmap);

          const bodyAndFaceRegions = detectBodyAndFaceRegions(landmarkPaires)
          console.log(bodyAndFaceRegions)

          canvas.toBlob(async (blob) => {
            const imageBitmap = await createImageBitmap(blob);
            const landmarkPaires = await detectLandmarkPaires(imageBitmap);

            const bodyAndFaceRegions = detectBodyAndFaceRegions(landmarkPaires)
            console.log(bodyAndFaceRegions)

            const newCanvas = await drawNtoushin(imageBitmap, bodyAndFaceRegions)
            ctx.drawImage(newCanvas, 0, 0);

          }, 'image/jpeg');

          displayHeadRatio(ctx, bodyAndFaceRegions);
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

  const detectLandmarkPaires = async (imageBitmap) => {
    const landmarkPaires = []

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    const poseLandmarks = await detectPoseLandmarks(vision, imageBitmap);

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

      // 顔のある領域から顔ランドマークを取得
      const croppedImageBitmap = await cropImageBitmap(imageBitmap, cropX, cropY, cropWidth, cropHeight)
      const cropprdFaceLandmarks = await detectFaceLandmarks(vision, croppedImageBitmap)

      if (cropprdFaceLandmarks.faceLandmarks) {
        cropprdFaceLandmarks.faceLandmarks.forEach(faceLandmarks => {
          faceLandmarks.forEach(landmark => {
            landmark.x = (cropX + landmark.x * cropWidth) / imageBitmap.width
            landmark.y = (cropY + landmark.y * cropHeight) / imageBitmap.height
          });
        });
        // 顔ランドマークが複数見つかっても、1つだけ使用
        landmarkPaires.push({ poseLandmarks: landmarks, faceLandmarks: cropprdFaceLandmarks.faceLandmarks[0] })
      }
    };

    return landmarkPaires
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


  const detectBodyAndFaceRegions = (landmarkPaires) => {
    console.log(landmarkPaires)

    const canvas = canvasRef.current;
    const bodyAndFaceRegions = []

    landmarkPaires.forEach(landmarkPaire => {

      const poseLandmarks = landmarkPaire.poseLandmarks
      const faceLandmarks = landmarkPaire.faceLandmarks

      const centerX = faceLandmarks[4].x
      const centerY = faceLandmarks[4].y

      const face_bottom = faceLandmarks[152].y
      const face_left = faceLandmarks[127].x
      const face_right = faceLandmarks[356].x
      const eye_height = (faceLandmarks[468].y + faceLandmarks[473].y) / 2

      const head_top = centerY + (eye_height - centerY) * 4.3
      const head_bottom = face_bottom
      const head_left = centerX + (face_left - centerX) * 1.1
      const head_right = centerX + (face_right - centerX) * 1.1

      const x = head_left * canvas.width
      const y = head_top * canvas.height
      const width = (head_right - head_left) * canvas.width
      const height = (head_bottom - head_top) * canvas.height

      const body_bottom = Math.max(poseLandmarks[31].y, poseLandmarks[32].y) * canvas.height * 1.02

      const bodyRegion = { x: null, y, width: null, height: body_bottom - y }
      const faceRegion = { x, y, width, height }

      bodyAndFaceRegions.push({ bodyRegion, faceRegion })
    });

    return bodyAndFaceRegions
  };


  const drawNtoushin = (imageBitmap, bodyAndFaceRegions) => {
    // 画像の幅と高さを取得
    const imageWidth = imageBitmap.width;
    const imageHeight = imageBitmap.height;

    // 新しいキャンバスを作成
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // 体と顔の領域を取得
    const { bodyRegion, faceRegion } = bodyAndFaceRegions[0];

    // 頭身の計算（体の高さ / 顔の高さ）
    const headRatio = bodyRegion.height / faceRegion.height;

    // 新しいキャンバスのサイズを設定
    canvas.width = imageWidth;
    canvas.height = imageHeight;

    // 元の画像を描画
    context.drawImage(imageBitmap, 0, 0);

    // 顔を縦に並べて描画
    let position_x
    const left_space = imageWidth - (faceRegion.x + faceRegion.width)
    if (left_space > faceRegion.width * 2) {
      position_x = faceRegion.x + faceRegion.width * 2
    }
    else if (left_space > faceRegion.width) {
      position_x = imageWidth - faceRegion.width
    }
    else {
      position_x = faceRegion.x + faceRegion.width
    }

    for (let i = 0; i < Math.floor(headRatio); i++) {
      context.drawImage(imageBitmap, faceRegion.x, faceRegion.y, faceRegion.width, faceRegion.height,
        position_x, faceRegion.y + faceRegion.height * i, faceRegion.width, faceRegion.height);
    }

    context.drawImage(imageBitmap, faceRegion.x, faceRegion.y, faceRegion.width, faceRegion.height * (headRatio - Math.floor(headRatio)),
      position_x, faceRegion.y + faceRegion.height * Math.floor(headRatio), faceRegion.width, faceRegion.height * (headRatio - Math.floor(headRatio)));

    // 新しい画像を返却
    return canvas;
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleReset = () => {
    setImage(null);
    fileInputRef.current.value = '';
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    setHeadRatioText(null)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const displayHeadRatio = (ctx, bodyAndFaceRegions) => {
    const { bodyRegion, faceRegion } = bodyAndFaceRegions[0];
    const headRatio = bodyRegion.height / faceRegion.height;
    setHeadRatioText(`${headRatio.toFixed(1)}`);
  };


  return (
    <div className="container">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleImageChange}
      />
      {!image ? (
        <div>
          <h1>🤖&lt; <b>ＡＩ</b>診断<br/>あなたは何頭身？</h1>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ marginRight: '10px' }}>全身の画像をアップロード</div>
            <button className="btn btn-primary" onClick={handleButtonClick}>画像を選択</button>
          </div>
        </div>
      ) : (
        <div className="image-preview mt-3">
          <h2>🤖&lt; あなたは: <b className="head-ratio-text">{headRatioText}</b>頭身</h2>
          <canvas ref={canvasRef} className="img-thumbnail"></canvas>
          <div>
            <button className="btn btn-secondary mt-3" onClick={handleReset}>もう一度試す</button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<ImageUpload />, document.getElementById('app'));
