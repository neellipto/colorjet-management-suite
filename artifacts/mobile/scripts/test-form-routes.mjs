import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, 'constants/formRoutes.ts'), 'utf8');
const schemaSource = fs.readFileSync(path.join(root, 'constants/formSchemas.ts'), 'utf8');
const tuples = [...routeSource.matchAll(/\['([^']+)','([^']+)','([^']+)','([^']+)','([^']+)','([^']+)','([^']+)','([^']+)'\]/g)]
  .map(match => ({ key:match[1], route:match[2], screen:match[3], formId:match[4], title:match[5], endpoint:match[6], mutationKey:match[7], permission:match[8] }));

if (tuples.length < 25) throw new Error(`Expected at least 25 explicit create forms; found ${tuples.length}`);
for (const prop of ['key','route','screen','formId','mutationKey']) {
 const values=tuples.map(item=>item[prop]);
 const duplicates=values.filter((value,index)=>values.indexOf(value)!==index);
 if(duplicates.length) throw new Error(`Duplicate ${prop}: ${[...new Set(duplicates)].join(', ')}`);
}
for(const item of tuples){
 if(!schemaSource.includes(`'${item.formId}':{formId:'${item.formId}'`)) throw new Error(`Missing schema for ${item.formId}`);
 if(item.route.includes('/operations/')) throw new Error(`Generic operation fallback forbidden: ${item.route}`);
 if(!item.endpoint.startsWith('/api/')) throw new Error(`Invalid endpoint for ${item.key}`);
}
const minimum={
 'employee.create':'/employees/new',
 'employeeCard.issue':'/employees/[employeeId]/id-card/issue',
 'attendance.checkIn':'/attendance/check-in',
 'attendance.checkOut':'/attendance/check-out',
 'message.compose':'/messages/compose',
 'messageGroup.create':'/messages/groups/new',
 'push.create':'/admin/push-notifications/new',
 'customer.create':'/customers/new',
 'task.create':'/tasks/new',
 'engineer.create':'/admin/engineers/new',
 'schedule.create':'/engineer-schedule/new',
 'ticket.create':'/service/tickets/new',
 'warranty.create':'/warranty/new',
 'product.create':'/inventory/products/new',
 'stockIn.create':'/inventory/stock-in/new',
 'stockOut.create':'/inventory/stock-out/new',
 'supplier.create':'/suppliers/new',
 'purchaseOrder.create':'/purchases/orders/new',
 'lc.create':'/foreign-purchase/lc/new',
 'shipment.create':'/logistics/shipments/new',
 'payment.create':'/accounts/payments/new',
 'expense.create':'/accounts/expenses/new',
 'agreement.create':'/agreements/new',
};
for(const [key,route] of Object.entries(minimum)){
 const found=tuples.find(item=>item.key===key);
 if(!found||found.route!==route) throw new Error(`Route regression: ${key} must open ${route}`);
}
console.log(`PASS: ${tuples.length} explicit form routes have unique route, screen, formId and mutationKey mappings.`);
