export type FormRouteDefinition = {
  key: string;
  route: string;
  screen: string;
  formId: string;
  title: string;
  endpoint: string;
  mutationKey: string;
  permission: string;
};

export const FORM_ROUTES: readonly FormRouteDefinition[] = [
  ['employee.create','/employees/new','EmployeeCreateScreen','employee-create','Add Employee','/api/employees','employees.create','employees.create'],
  ['employeeCard.issue','/employees/[employeeId]/id-card/issue','EmployeeIdCardIssueScreen','employee-id-card-issue','Issue Employee ID Card','/api/employees/{employeeId}/id-card','employee-card.issue','employees.id_card.issue'],
  ['attendance.checkIn','/attendance/check-in','AttendanceCheckInScreen','attendance-check-in','Attendance Check-In','/api/attendance/check-in','attendance.check-in','attendance.check_in'],
  ['attendance.checkOut','/attendance/check-out','AttendanceCheckOutScreen','attendance-check-out','Attendance Check-Out','/api/attendance/check-out','attendance.check-out','attendance.check_out'],
  ['message.compose','/messages/compose','MessageComposeScreen','message-compose','Compose Message','/api/messages','messages.send','messages.send'],
  ['messageGroup.create','/messages/groups/new','MessageGroupCreateScreen','message-group-create','Create Message Group','/api/message-groups','message-groups.create','messages.groups.create'],
  ['push.create','/admin/push-notifications/new','PushNotificationCreateScreen','push-notification-create','Create Push Notification','/api/push-notifications','push-notifications.create','notifications.create'],
  ['customer.create','/customers/new','CustomerCreateScreen','customer-create','Add Customer','/api/customers','customers.create','customers.create'],
  ['task.create','/tasks/new','TaskCreateScreen','task-create','Create Office Task','/api/tasks','tasks.create','tasks.create'],
  ['engineer.create','/admin/engineers/new','EngineerCreateScreen','engineer-create','Add Engineer Profile','/api/engineers','engineers.create','engineers.create'],
  ['schedule.create','/engineer-schedule/new','EngineerScheduleCreateScreen','engineer-schedule-create','Create Engineer Schedule','/api/engineer-schedule','engineer-schedule.create','engineer_schedule.create'],
  ['ticket.create','/service/tickets/new','ServiceTicketCreateScreen','service-ticket-create','Create Service Ticket','/api/service-tickets','service-tickets.create','service_tickets.create'],
  ['warranty.create','/warranty/new','WarrantyCreateScreen','warranty-create','Register Warranty','/api/warranties','warranties.create','warranties.create'],
  ['product.create','/inventory/products/new','ProductCreateScreen','product-create','Add Product','/api/products','products.create','products.create'],
  ['stockIn.create','/inventory/stock-in/new','StockInCreateScreen','stock-in-create','Stock In','/api/stock-in','stock-in.create','stock.create'],
  ['stockOut.create','/inventory/stock-out/new','StockOutCreateScreen','stock-out-create','Stock Out','/api/stock-out','stock-out.create','stock.create'],
  ['supplier.create','/suppliers/new','SupplierCreateScreen','supplier-create','Add Supplier','/api/suppliers','suppliers.create','suppliers.create'],
  ['purchaseOrder.create','/purchases/orders/new','PurchaseOrderCreateScreen','purchase-order-create','Create Purchase Order','/api/purchase-orders','purchase-orders.create','purchases.create'],
  ['lc.create','/foreign-purchase/lc/new','LcRecordCreateScreen','lc-record-create','Create LC Record','/api/lc-records','lc-records.create','foreign_purchase.create'],
  ['shipment.create','/logistics/shipments/new','ShipmentCreateScreen','shipment-create','Create Shipment','/api/shipments','shipments.create','logistics.create'],
  ['payment.create','/accounts/payments/new','PaymentCreateScreen','payment-create','Receive Payment','/api/payments','payments.create','payments.create'],
  ['expense.create','/accounts/expenses/new','ExpenseCreateScreen','expense-create','Add Expense','/api/expenses','expenses.create','expenses.create'],
  ['agreement.create','/agreements/new','AgreementCreateScreen','agreement-create','Create Agreement','/api/agreements','agreements.create','agreements.create'],
  ['document.create','/documents/new','DocumentCreateScreen','document-create','Upload Document','/api/documents','documents.create','documents.create'],
  ['user.create','/admin/users/new','UserCreateScreen','user-create','Add User','/api/users','users.create','users.create'],
].map(([key, route, screen, formId, title, endpoint, mutationKey, permission]) => ({
  key, route, screen, formId, title, endpoint, mutationKey, permission,
})) as readonly FormRouteDefinition[];

export function getFormRoute(key: string): FormRouteDefinition {
  const definition = FORM_ROUTES.find(item => item.key === key);
  if (!definition) {
    throw new Error(`FORM_ROUTE_CONFIGURATION_ERROR: No explicit form route for "${key}". Generic fallback forms are forbidden.`);
  }
  return definition;
}
