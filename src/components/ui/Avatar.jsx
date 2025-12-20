export default function Avatar({ src, size = 40 }) {
  return (
    <img
      src={src}
      alt="avatar"
      style={{ width: size, height: size }}
      className="rounded-full object-cover"
    />
  );
}
