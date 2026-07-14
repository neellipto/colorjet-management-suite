import { Ionicons } from '@expo/vector-icons';
export type Field={key:string;label:string;required?:boolean;numeric?:boolean;multiline?:boolean};
export type ModuleConfig={key:string;group:string;title:string;subtitle:string;icon:keyof typeof Ionicons.glyphMap;listPath:string;createPath?:string;roles?:string[];primaryKeys:string[];secondaryKeys:string[];statusKeys?:string[];fields?:Field[]};
const rows=`customers|Sales & CRM|Customers|customers|customers
invoices|Sales & CRM|Invoices|invoices|invoices
payments|Sales & CRM|Customer Receipts|collections/followups|payments/customer-receipts
products|Inventory|Products & Stock|products|products
stock_movements|Inventory|Stock Movements|stock/movements|
replenishment|Inventory|Replenishment Plans|inventory/replenishment/plans|
inventory_counts|Inventory|Inventory Counts|inventory/counts|
tasks|Operations|Office Tasks|tasks|tasks
attendance|Operations|Attendance & Duty|operations/attendance/today|
visits|Operations|Customer Visits|operations/visits|
leave|HR|Leave Requests|operations/leave|operations/leave
employee_cards|HR|Employee Directory & ID|employee-cards|
service|Service|Service Tickets|service-tickets|service-tickets
engineer_jobs|Service|Engineer Job Board|engineer-jobs/field-board|
parts_requests|Service|Spare Parts Requests|operations/parts-requests|
purchases|Purchase & Import|Purchases|purchases|purchases
shipments|Purchase & Import|Import Shipments|import-logistics/shipments|import-logistics/shipments
rmas|Purchase & Import|Warranty RMA|import-logistics/rmas|import-logistics/rmas
supplier_ledger|Purchase & Import|Supplier Ledger|import-logistics/supplier-ledger|import-logistics/supplier-ledger
supplier_payables|Purchase & Import|Supplier Payment Plans|supplier-payables/plans|
import_intelligence|Purchase & Import|Import Intelligence|import-intelligence|
expenses|Finance|Expenses|expenses|expenses
cash_bank|Finance|Cash & Bank|cash-bank/accounts|
daily_ledger|Finance|Daily Ledger|reports/daily-ledger|
agreements|Finance|Agreements & EMI|agreements|
messages|Communication|Internal Messages|messages|messages
notifications|Communication|Notifications|notifications|
support|Communication|Support Requests|support-requests|support-requests
claims|Control & Audit|Supplier Claims|supplier-claims|supplier-claims
qr_codes|Control & Audit|QR Suite|qr-codes|qr-codes
data_quality|Control & Audit|Data Quality|data-quality|
alerts|Control & Audit|Alerts Center|alerts|
reports|Control & Audit|Reports Center|reports/summary|
attendance-location|Operations|Attendance Location|operations/attendance/today|
office-tasks|Operations|Office Task Control|tasks|tasks
stock-movements|Inventory|Stock Movement Control|stock/movements|
spare-parts|Inventory|Spare Parts Control|parts/requests|parts/requests
warehouse-receiving|Inventory|Warehouse Receiving|warehouse/receiving|
receiving-discrepancy|Inventory|Receiving Discrepancy|warehouse/receiving-discrepancies|
service-tickets|Service|Service Ticket Control|service-tickets|service-tickets
engineer-schedule|Service|Engineer Schedule|engineer-schedule|engineer-schedule
delivery|Service|Delivery & Installation|delivery|
warranty-register|Service|Warranty Register|warranty|warranty
agreements-emi|Finance|Agreements & EMI Control|agreements|agreements
daily-ledger|Finance|Daily Ledger Control|ledger/daily|
customer-ledger|Finance|Customer Ledger|ledger/customers|
import-control-center|Purchase & Import|Import Control Center|import-logistics/control-center|
suppliers|Purchase & Import|Suppliers|suppliers|suppliers
foreign-purchase|Purchase & Import|Foreign Purchase|foreign-purchase|foreign-purchase
lc-tt|Purchase & Import|LC / TT Management|lc-tt|lc-tt
landed-cost|Purchase & Import|Landed Cost|landed-cost|landed-cost
employee-directory|HR|Employee Directory|employees|
users|Administration|Users & Permissions|users|users`;
const icons:Record<string,keyof typeof Ionicons.glyphMap>={'Sales & CRM':'people-outline',Inventory:'cube-outline',Operations:'checkbox-outline',HR:'people-circle-outline',Service:'construct-outline','Purchase & Import':'boat-outline',Finance:'cash-outline',Communication:'chatbubbles-outline','Control & Audit':'bar-chart-outline',Administration:'settings-outline'};
const fields:Record<string,Field[]>={
customers:[{key:'name',label:'Customer name',required:true},{key:'phone',label:'Phone'},{key:'company_name',label:'Company'},{key:'address',label:'Address',multiline:true}],
invoices:[{key:'customer_id',label:'Customer ID',required:true,numeric:true},{key:'invoice_date',label:'Invoice date',required:true},{key:'due_date',label:'Due date'}],
payments:[{key:'customer_id',label:'Customer ID',required:true,numeric:true},{key:'amount',label:'Amount',required:true,numeric:true},{key:'payment_method',label:'Payment method'}],
products:[{key:'name',label:'Product name',required:true},{key:'sku',label:'SKU'},{key:'selling_price',label:'Selling price',numeric:true},{key:'opening_stock',label:'Opening stock',numeric:true}],
tasks:[{key:'title',label:'Task title',required:true},{key:'assigned_to',label:'Assigned user ID'},{key:'due_date',label:'Due date'},{key:'priority',label:'Priority'},{key:'notes',label:'Notes',multiline:true}],
leave:[{key:'leave_type_id',label:'Leave type ID',required:true,numeric:true},{key:'start_date',label:'Start date',required:true},{key:'end_date',label:'End date',required:true},{key:'reason',label:'Reason',multiline:true}],
service:[{key:'customer_id',label:'Customer ID',required:true,numeric:true},{key:'machine_model',label:'Machine model'},{key:'serial_number',label:'Serial number'},{key:'problem_description',label:'Problem description',required:true,multiline:true}],
purchases:[{key:'supplier_id',label:'Supplier ID',required:true,numeric:true},{key:'purchase_date',label:'Purchase date',required:true},{key:'currency',label:'Currency'},{key:'exchange_rate',label:'Exchange rate',numeric:true}],
shipments:[{key:'supplier_id',label:'Supplier ID',required:true,numeric:true},{key:'shipment_number',label:'Shipment number',required:true},{key:'bl_number',label:'BL number'},{key:'container_number',label:'Container number'},{key:'eta_date',label:'ETA'}],
rmas:[{key:'supplier_id',label:'Supplier ID',required:true,numeric:true},{key:'serial_number',label:'Serial number',required:true},{key:'fault_description',label:'Fault description',required:true,multiline:true}],
suppliers:[{key:'name',label:'Supplier name',required:true},{key:'phone',label:'Phone'},{key:'email',label:'Email'},{key:'country',label:'Country'}],
'foreign-purchase':[{key:'supplier_id',label:'Supplier ID',required:true,numeric:true},{key:'pi_number',label:'PI number',required:true},{key:'currency',label:'Currency'},{key:'total_value',label:'Total value',numeric:true}],
'lc-tt':[{key:'supplier_id',label:'Supplier ID',required:true,numeric:true},{key:'payment_type',label:'LC or TT',required:true},{key:'reference_number',label:'Reference',required:true},{key:'amount',label:'Amount',numeric:true}],
'landed-cost':[{key:'purchase_order_id',label:'Purchase order ID',required:true,numeric:true},{key:'shipping_cost',label:'Shipping cost',numeric:true},{key:'customs_duty',label:'Customs duty',numeric:true},{key:'cnf_cost',label:'C&F cost',numeric:true}],
users:[{key:'name',label:'Full name',required:true},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'employee_code',label:'Employee code'},{key:'role',label:'Role',required:true}]
};
export const modules:ModuleConfig[]=rows.split('\n').map(line=>{const [key,group,title,listPath,createPath]=line.split('|');return{key,group,title,subtitle:group,icon:icons[group]??'apps-outline',listPath,...(createPath&&fields[key]?{createPath,fields:fields[key]}:{}),primaryKeys:['name','title'],secondaryKeys:['reference_no','created_at'],statusKeys:['status']}});
export const moduleByKey=Object.fromEntries(modules.map(m=>[m.key,m])) as Record<string,ModuleConfig>;
export const moduleGroups=[...new Set(modules.map(m=>m.group))];
