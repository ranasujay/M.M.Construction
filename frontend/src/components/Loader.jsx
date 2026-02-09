export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-10 h-10 border-4 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
      <p className="mt-4 text-sm text-gray-400">{text}</p>
    </div>
  );
}
