export function isPaid(order){
  return ['Paid','Demo verified'].includes(order.payment)
}

export function paymentLabel(order){
  if(isPaid(order))return 'Paid'
  if(['Rejected','Demo rejected'].includes(order.payment))return 'Proof rejected'
  return order.paymentProof?'Pending · proof submitted':'Pending payment'
}
