/**
 * Pins the behaviour of the Partially Delivered roll-up.
 *
 * Order status is derived from item statuses by calculateOrderStatus, so
 * "Partially Delivered" is only ever a computed roll-up - no item ever holds
 * it. getValidTransitions has no entry for it, so admin order-level status
 * changes are refused; progress happens through item-level updates, which
 * recompute the roll-up. These two tests pin both halves of that, since the
 * refusal reads like a bug until you see the second test pass.
 */
import * as orderService from '../order.service';
import { ORDER_STATUS } from '../../../common/constants/order.constants';
import { createTestOrder, cleanupTestData } from '../../../common/testing/test-data';
import * as db from '../../../common/testing/db';
import Order from '../order.model';

const createdOrders: string[] = [];

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await cleanupTestData(createdOrders);
  await db.disconnect();
});

describe('Partially Delivered behaviour', () => {
  it('reports no valid ORDER-level transitions', () => {
    const transitions = orderService.getValidTransitions(ORDER_STATUS.PARTIALLY_DELIVERED);
    expect(transitions).toEqual([]);
    expect(
      orderService.isValidStatusTransition(
        ORDER_STATUS.PARTIALLY_DELIVERED,
        ORDER_STATUS.DELIVERED
      )
    ).toBe(false);
  });

  it('still progresses to Delivered through ITEM-level updates', async () => {
    const order = await createTestOrder({
      itemCount: 3,
      paymentMethod: 'cod',
      orderStatus: ORDER_STATUS.SHIPPED,
      itemStatus: ORDER_STATUS.SHIPPED
    });
    createdOrders.push(order.orderId);

    // Deliver one of three -> the roll-up should be Partially Delivered.
    await orderService.updateItemStatus(
      order.orderId,
      String(order.items[0]._id),
      ORDER_STATUS.DELIVERED
    );

    const partial = await Order.findOne({ orderId: order.orderId });
    expect(partial!.status).toBe(ORDER_STATUS.PARTIALLY_DELIVERED);

    // Deliver the remaining two.
    await orderService.updateItemStatus(
      order.orderId,
      String(order.items[1]._id),
      ORDER_STATUS.DELIVERED
    );
    await orderService.updateItemStatus(
      order.orderId,
      String(order.items[2]._id),
      ORDER_STATUS.DELIVERED
    );

    const done = await Order.findOne({ orderId: order.orderId });
    expect(done!.status).toBe(ORDER_STATUS.DELIVERED);
  });
});
