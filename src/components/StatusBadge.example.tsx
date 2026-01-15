/**
 * Example usage of StatusBadge component
 * 
 * This file demonstrates how to use the StatusBadge component
 * in various contexts within a white-mode dashboard.
 */

import StatusBadge from "./StatusBadge";

export default function StatusBadgeExamples() {
  return (
    <div className="space-y-8 p-8 bg-white">
      {/* Example 1: Table Row */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Example 1: Table Row</h3>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-4 text-left text-sm font-medium text-gray-700">Invoice #</th>
              <th className="p-4 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="p-4 text-left text-sm font-medium text-gray-700">Amount</th>
              <th className="p-4 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-4 text-sm text-gray-900">#INV-001</td>
              <td className="p-4">
                <StatusBadge status="pending" />
              </td>
              <td className="p-4 text-sm text-gray-900">$1,500.00</td>
              <td className="p-4">
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors">
                    Approve
                  </button>
                  <button className="px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 text-sm rounded-md transition-colors">
                    Reject
                  </button>
                </div>
              </td>
            </tr>
            <tr className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-4 text-sm text-gray-900">#INV-002</td>
              <td className="p-4">
                <StatusBadge status="approved" />
              </td>
              <td className="p-4 text-sm text-gray-900">$2,300.00</td>
              <td className="p-4">
                <span className="text-sm text-gray-500">Completed</span>
              </td>
            </tr>
            <tr className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-4 text-sm text-gray-900">#INV-003</td>
              <td className="p-4">
                <StatusBadge status="rejected" />
              </td>
              <td className="p-4 text-sm text-gray-900">$850.00</td>
              <td className="p-4">
                <span className="text-sm text-gray-500">No action available</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Example 2: Card Layout */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Example 2: Card Layout</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Payment Request #1</h4>
              <StatusBadge status="pending" />
            </div>
            <p className="text-sm text-gray-600 mb-4">Requested: Jan 15, 2024</p>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors">
                Approve
              </button>
              <button className="flex-1 px-3 py-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm rounded-md transition-colors">
                Reject
              </button>
            </div>
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Payment Request #2</h4>
              <StatusBadge status="approved" />
            </div>
            <p className="text-sm text-gray-600 mb-4">Approved: Jan 10, 2024</p>
            <div className="text-sm text-gray-500">Payment processed</div>
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Payment Request #3</h4>
              <StatusBadge status="rejected" />
            </div>
            <p className="text-sm text-gray-600 mb-4">Rejected: Jan 8, 2024</p>
            <div className="text-sm text-gray-500">Reason: Insufficient funds</div>
          </div>
        </div>
      </div>

      {/* Example 3: Standalone Badges */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Example 3: All Status Types</h3>
        <div className="flex gap-4">
          <StatusBadge status="pending" />
          <StatusBadge status="approved" />
          <StatusBadge status="rejected" />
        </div>
      </div>
    </div>
  );
}



