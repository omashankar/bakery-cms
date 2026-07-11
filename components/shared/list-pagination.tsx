"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getPageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, "ellipsis", total];
  }

  if (current >= total - 2) {
    return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  }

  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export function ListPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: ListPaginationProps) {
  if (totalPages <= 1) return null;

  const pageItems = getPageItems(currentPage, totalPages);

  return (
    <Pagination className={cn("justify-end", className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(event) => {
              event.preventDefault();
              onPageChange(Math.max(1, currentPage - 1));
            }}
            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        <PaginationItem className="sm:hidden">
          <span className="px-2 text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
        </PaginationItem>

        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`} className="max-sm:hidden">
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item} className="max-sm:hidden">
              <PaginationLink
                href="#"
                isActive={item === currentPage}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(event) => {
              event.preventDefault();
              onPageChange(Math.min(totalPages, currentPage + 1));
            }}
            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
