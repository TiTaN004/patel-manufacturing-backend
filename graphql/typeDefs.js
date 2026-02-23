export const typeDefs = `#graphql

# types

  type Customer {
    id: ID
    name: String
    email: String
    mobile: String
    address: String
    city: String
    state: String
    zipcode: String
  }

  type OrderItem {
    id: ID!
    product_id: Int
    product_name: String
    unit_price: Float
    quantity: Int
    total_price: Float
    selected_filters: String
    sku: String
    primary_image: String
  }

  type Order {
    id: ID!
    invoice_number: String!
    invoice_url: String
    total_amount: Float!
    payment_mode: String
    payment_status: String
    order_status: String
    coupon_code: String
    discount_amount: Float
    shipping_fee: Float
    subtotal: Float
    created_at: String
    user_role: String
    customer: Customer
    items: [OrderItem]
  }

  type User {
    id: ID!
    name: String!
    email: String!
    mobile: String!
    address: String!
    city: String!
    state: String!
    zipcode: String!
    orders: [Order]
  }

  type Product{
    id: ID!
    category_id: ID!
    category: Category
    sku: String
    name: String!
    slug: String!
    price: Float!
    selling_price: Float!
    status: String!
    stock_quantity: Int!
    created_at: String!
    updated_at: String!
    stock_threshold: Int!
    stock_status: String!
    description: String
    primary_image: String
    images: String
    care_instructions: String
    warrenty_period: String
    dimension: String
    weight: String
    filterGroups: [ProductFilterGroup]
  }

  type Category{
    id: ID!
    name: String!
    parent_id: ID
    parent: Category
    path: String!
    level: Int!
    sort_order: Int
    is_active: Boolean!
    img_url: String
    created_at: String!
    updated_at: String!
    products: [Product]
    filters: [Filter]
    filterValues: [FilterValue]
    categoryFilters: [CategoryFilter]
  }

  type CategoryFilter{
    category_id: ID!
    filter_id: ID!
    is_required: Boolean
    sort_order: Int
  }

  type Filter{
    id: ID!
    name: String!
    code: String!
    type: String!
    values: [FilterValue]
    is_active: Boolean!
    created_at: String!
  }

  type FilterValue{
    id: ID!
    filter_id: ID!
    filter: Filter
    value: String!
    is_active: Boolean!
  }

  type ProductFilterValue{
    product_id: ID!
    filter_id: ID!
    value_id: ID!
    value: FilterValue
    product: Product
    filter: Filter
  }

  type ProductFilterGroup {
    filter: Filter
    values: [FilterValue]
  }

  type BulkOutstanding {
    userID: ID!
    amount: Float!
    updated_at: String
  }


# responses

  type ProductsResponse {
    total: Int
    count: Int
    items: [Product]
    }
    
  type CategoryResponse {
    total: Int
    count: Int
    items: [Category]
  }

# inputs

  input ProductFilterInput {
    id: ID
    search: String
    status: String
    category_id: ID
    sort: String
  }
  input CategoryFilterInput {
    id: ID
    search: String
    is_active: Boolean
    parent_id: ID
  }
  input FilterInput {
    id: ID
    search: String
    is_active: Boolean
  }

  # category inputs
  input CreateCategoryInput {
    name: String!
    parent_id: ID
  }

  input DeleteCategoryInput {
    id: ID!
  }

  # input UploadImageInput {
  #   id: ID!
  #   file: !
  # }

  input UpdateCategoryInput {
    id: ID!
    name: String!
  }

  # filter inputs
  input CreateFilterInput {
    name: String!
    code: String!
    type: String!
    values: [String]
    categoryIds: [ID]
  }

  input UpdateFilterInput {
    id: ID!
    name: String!
    code: String!
    type: String!
    values: [String]
    categoryIds: [ID]
  }

  input DeleteFilterInput {
    id: ID!
  }

  # product inputs
  input CreateProductInput {
    category_id: ID!
    sku: String!
    name: String!
    slug: String!
    price: Float!
    status: String!
    stock_quantity: Int!
    stock_status: String!
    description: String
    primary_image: String
    images: [String]
    stock_threshold: Int!
    selling_price: Float!
    care_instructions: String
    warrenty_period: String
    dimension: String
    weight: String
    filters: [ProductFilterInput]
  }

  input UpdateProductInput {
    id: ID!
    category_id: ID
    sku: String
    name: String
    slug: String
    price: Float
    status: String
    stock_quantity: Int
    stock_status: String
    description: String
    primary_image: String
    images: [String]
    stock_threshold: Int
    selling_price: Float
    care_instructions: String
    warrenty_period: String
    dimension: String
    weight: String
    filters: [ProductFilterInput]
  }

  input DeleteProductInput {
    id: ID!
  }

  input AssignProductsToBulkUserInput {
    userID: ID!
    productIDs: [ID]!
  }

      
  type Query {
    userOrders(user_type: String, limit: Int, offset: Int, search: String): [Order]
    order(id: ID!): Order
    userOrdersHistory: [User]
    categories(filter: CategoryFilterInput, limit: Int, offset: Int): CategoryResponse
    products(filter: ProductFilterInput, limit: Int, offset: Int): ProductsResponse
    filters(filter: FilterInput): [Filter]
    filterValues(filter_id: ID!): [FilterValue]
    categoryFilters(category_id: ID!): [CategoryFilter]
    productFilterValues: [ProductFilterValue]
    bulkUserProducts(userID: ID!): [Product]
    bulkOutstanding(userID: ID!): Float
  }

  type Mutation {

    # category
    createCategory(input: CreateCategoryInput!): Category
    deleteCategory(input: DeleteCategoryInput!): String
    updateCategory(input: UpdateCategoryInput!): Category

    # filter
    createFilter(input: CreateFilterInput!): Filter
    updateFilter(input: UpdateFilterInput!): Filter
    deleteFilter(input: DeleteFilterInput!): Filter

    # product
    deleteProduct(input: DeleteProductInput!): String
    updateProduct(input: UpdateProductInput!): Product
    createProduct(input: CreateProductInput!): Product

    # bulk
    assignProductsToBulkUser(input: AssignProductsToBulkUserInput!): String
    upsertBulkOutstanding(userID: ID!, amount: Float!): BulkOutstanding
  }
`;
