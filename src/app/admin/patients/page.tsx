import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const patients = [
  { id: 'p_1', name: 'Ali Khan', email: 'ali.k@example.com', lastBooking: '2023-10-26', status: 'Active' },
  { id: 'p_2', name: 'Sana Ahmed', email: 'sana.a@example.com', lastBooking: '2023-10-25', status: 'Active' },
  { id: 'p_3', name: 'Zoya Farooq', email: 'zoya.f@example.com', lastBooking: '2023-08-12', status: 'Inactive' },
  { id: 'p_4', name: 'Usman Sharif', email: 'usman.s@example.com', lastBooking: '2023-10-24', status: 'Active' },
  { id: 'p_5', name: 'Hina Iqbal', email: 'hina.i@example.com', lastBooking: '2023-05-01', status: 'Inactive' },
];

export default function AdminPatientsPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold font-headline mb-6">Patient Management</h1>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Last Booking</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell className="font-mono text-xs">{patient.id}</TableCell>
                <TableCell>{patient.name}</TableCell>
                <TableCell>{patient.email}</TableCell>
                <TableCell>{patient.lastBooking}</TableCell>
                <TableCell>
                  <Badge variant={patient.status === 'Active' ? 'secondary' : 'outline'} className={patient.status === 'Active' ? "bg-green-100 text-green-800" : ""}>
                    {patient.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
