export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-16 h-16 text-gray-600 mb-4" />}
      <h3 className="text-lg font-medium text-gray-300 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-6 max-w-md">{description}</p>}
      {action && action}
    </div>
  );
}
