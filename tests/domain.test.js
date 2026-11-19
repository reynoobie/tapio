import test from 'node:test'
import assert from 'node:assert/strict'
import { priceOrder, publicProfile, validUsername } from '../src/lib/domain.js'

test('public profiles exclude hidden contacts and hidden sections', () => {
  const privateProfile = {
    name: 'Rey',
    email: 'private@example.com',
    phone: '+639171234567',
    website: 'https://example.com',
    privacy: { email: 'Hidden', phone: 'Request access', website: 'Public' },
    sections: [
      { id: 'one', hidden: true, body: 'Draft content' },
      { id: 'two', hidden: false, body: 'Published' },
    ],
  }
  const result = publicProfile(privateProfile)
  assert.equal(result.email, '')
  assert.equal(result.phone, '')
  assert.equal(result.website, 'https://example.com')
  assert.deepEqual(
    result.sections.map((section) => section.id),
    ['two'],
  )
  assert.equal(privateProfile.email, 'private@example.com')
})
test('order totals use catalog prices and combine stock across custom designs', () => {
  const products = new Map([
    ['custom', { name: 'Custom card', price: 899, available: true, stock: 2 }],
  ])
  const item = { productId: 'custom', quantity: 1, price: 0.01, design: { name: 'Rey' } }
  assert.equal(priceOrder([item, item], products).total, 1798)
  assert.throws(() => priceOrder([item, item, item], products), /stock/)
  assert.throws(() => priceOrder([{ ...item, quantity: -1 }], products), /quantity/)
  assert.throws(() => priceOrder([{ ...item, design: { name: ' ' } }], products), /name/)
})
test('usernames reject paths, reserved names, and malformed identifiers', () => {
  assert.ok(validUsername('reynaldo-123'))
  for (const value of ['admin', 'ab', '../alex', 'alex/name', 'Alex', 'a b', null])
    assert.equal(validUsername(value), false)
})
