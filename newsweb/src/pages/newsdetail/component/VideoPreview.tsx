const VideoPreview = () => {
  return (
    <div style={{ padding: 20 }}>
      <video
        controls
        style={{ width: '100%', height: 'auto' }}
        src="./video/video.mp4"
        poster="./video/暴雪.jpg"
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
};

export default VideoPreview;
