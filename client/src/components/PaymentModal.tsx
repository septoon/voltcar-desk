import React from "react";

type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  payMethod: "cash" | "card";
  setPayMethod: (method: "cash" | "card") => void;
  payAmountInput: string;
  setPayAmountInput: (val: string) => void;
  parseInputNumber: (value: string) => number;
  total: number;
  paid: number;
  servicesTotal: number;
  partsTotal: number;
  discountValue: number;
  servicesCount: number;
  partsCount: number;
  handleKeypad: (val: string) => void;
  handleInvoiceCreate: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  ghostBtn: string;
  smallBtn: string;
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onClose,
  orderNumber,
  payMethod,
  setPayMethod,
  payAmountInput,
  setPayAmountInput,
  parseInputNumber,
  total,
  paid,
  servicesTotal,
  partsTotal,
  discountValue,
  servicesCount,
  partsCount,
  handleKeypad,
  handleInvoiceCreate,
  ghostBtn,
  smallBtn,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-[#dcdcdc] bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#1f1f1f]">Оплата заказа</h3>
            <p className="text-sm text-[#555555]">Заказ № {orderNumber}</p>
          </div>
          <button className={`${ghostBtn} ${smallBtn} rounded-md`} onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="flex justify-between max-[960px]:flex-col gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
          <div className="flex w-1/2 max-[960px]:w-full flex-col gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3">
            <div className="grid grid-cols-3 gap-2">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "back"].map((key) => (
                <button
                  key={key}
                  className="rounded-md border border-[#e2b007] bg-[#ffd54f] px-3 py-3 text-[18px] font-bold text-[#1f1f1f] shadow-sm hover:bg-[#ffc930]"
                  onClick={() => handleKeypad(key === "," ? "," : key)}
                >
                  {key === "back" ? "⌫" : key}
                </button>
              ))}
              <button
                className="col-span-3 rounded-md border border-[#e2b007] bg-[#ffd54f] px-3 py-3 text-[14px] font-semibold text-[#1f1f1f] shadow-sm hover:bg-[#ffc930]"
                onClick={() => handleKeypad("clear")}
              >
                Сброс
              </button>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-[#e5e5e5] bg-[#fafafa] p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#555555]">Принято</span>
                <input
                  className="w-32 rounded-md border border-[#c3c3c3] bg-white px-2 py-1 text-right text-[14px] focus:outline-none"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#555555]">Сдача</span>
                <span className="text-[14px] font-semibold text-[#1f1f1f]">
                  {Math.max(parseInputNumber(payAmountInput) - Math.max(total - paid, 0), 0).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  руб.
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-[#e5e5e5] bg-[#fafafa] p-2 text-sm">
              <div className="font-semibold text-[#1f1f1f]">Позиции заказа</div>
              <div className="text-[#555555]">
                Работы: {servicesCount} шт. · {servicesTotal.toLocaleString("ru-RU")} руб.
              </div>
              <div className="text-[#555555]">
                Запчасти: {partsCount} шт. · {partsTotal.toLocaleString("ru-RU")} руб.
              </div>
            </div>
          </div>

          <div className="flex w-1/2 max-[960px]:w-full flex-col justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-[#555555]">Способы оплаты</span>
                <div className="flex flex-col gap-2">
                  <button
                    className={`w-full rounded-md border px-3 py-2 text-left text-[14px] font-semibold ${
                      payMethod === "cash"
                        ? "border-[#e2b007] bg-[#ffd54f]"
                        : "border-[#d6d6d6] bg-white hover:bg-[#f5f5f5]"
                    }`}
                    onClick={() => setPayMethod("cash")}
                  >
                    Наличные
                  </button>
                  <button
                    className={`w-full rounded-md border px-3 py-2 text-left text-[14px] font-semibold ${
                      payMethod === "card"
                        ? "border-[#e2b007] bg-[#ffd54f]"
                        : "border-[#d6d6d6] bg-white hover:bg-[#f5f5f5]"
                    }`}
                    onClick={() => setPayMethod("card")}
                  >
                    Перевод
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-1 rounded-md border border-[#e5e5e5] bg-white p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#555555]">Работы</span>
                    <span className="font-semibold text-[#1f1f1f]">{servicesTotal.toLocaleString("ru-RU")} руб.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#555555]">Запчасти</span>
                    <span className="font-semibold text-[#1f1f1f]">{partsTotal.toLocaleString("ru-RU")} руб.</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#555555]">Скидка</span>
                      <span className="font-semibold text-[#1f1f1f]">- {discountValue.toLocaleString("ru-RU")} руб.</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between border-t border-[#ededed] pt-1">
                    <span className="text-[#555555]">К оплате</span>
                    <span className="text-[16px] font-bold text-[#1f1f1f]">
                      {Math.max(total - paid, 0).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} руб.
                    </span>
                  </div>
                  {paid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#555555]">Уже оплачено</span>
                      <span className="font-semibold text-[#1f1f1f]">{paid.toLocaleString("ru-RU")} руб.</span>
                    </div>
                  )}
                </div>
              </div>
              <button
              className="rounded-md border self-stretch border-[#1f8f3a] bg-[#1fad4c] px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-[#179340]"
              onClick={handleInvoiceCreate}
            >
              Оплатить
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
